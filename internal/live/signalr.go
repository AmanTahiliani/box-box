package live

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/gorilla/websocket"
)

// ConnectToF1LiveTiming negotiates with the official F1 SignalR hub, subscribes
// to timing topics, and sends defensive snapshots on dataChan until the
// connection closes.
func ConnectToF1LiveTiming(dataChan chan LiveStreamData) error {
	if err := connectToF1SignalRCore(dataChan); err == nil {
		return nil
	} else {
		log.Printf("f1 signalrcore feed unavailable, trying legacy signalr: %v", err)
	}
	return connectToF1LegacySignalR(dataChan)
}

func connectToF1SignalRCore(dataChan chan LiveStreamData) error {
	req, err := http.NewRequest("POST", "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Origin", "https://www.formula1.com")
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Content-Length", "0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("f1 signalrcore negotiate returned %s", resp.Status)
	}

	var neg struct {
		ConnectionToken string `json:"connectionToken"`
	}
	if err := json.Unmarshal(body, &neg); err != nil {
		return err
	}
	if neg.ConnectionToken == "" {
		return fmt.Errorf("f1 signalrcore negotiate returned an empty connection token")
	}

	wsURL := "wss://livetiming.formula1.com/signalrcore?id=" + url.QueryEscape(neg.ConnectionToken)
	header := http.Header{}
	header.Set("Origin", "https://www.formula1.com")
	header.Set("User-Agent", "Mozilla/5.0")
	for _, cookie := range resp.Cookies() {
		header.Add("Cookie", cookie.String())
	}

	c, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return err
	}

	writeCoreFrame := func(payload any) error {
		body, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = append(body, signalRRecordSeparator)
		return c.WriteMessage(websocket.TextMessage, body)
	}

	if err := writeCoreFrame(map[string]any{"protocol": "json", "version": 1}); err != nil {
		c.Close()
		return err
	}
	_, handshake, err := c.ReadMessage()
	if err != nil {
		c.Close()
		return err
	}
	if !bytes.Contains(handshake, []byte("{}")) {
		c.Close()
		return fmt.Errorf("f1 signalrcore handshake returned %q", string(handshake))
	}

	topics := []string{
		"Heartbeat",
		"TimingData",
		"Position.z",
		"CarData.z",
		"DriverList",
		"LapCount",
		"ExtrapolatedClock",
		"TrackStatus",
		"RaceControlMessages",
		"WeatherData",
		"SessionInfo",
		"TeamRadio",
		"CurrentTyres",
		"TimingAppData",
		"TimingStats",
		"SessionStatus",
		"TopThree",
	}
	if err := writeCoreFrame(map[string]any{
		"type":         1,
		"target":       "subscribe",
		"arguments":    []any{topics},
		"invocationId": "1",
	}); err != nil {
		c.Close()
		return err
	}

	go func() {
		defer c.Close()
		state := NewState()

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("SignalR Core read error:", err)
				return
			}

			if state.ProcessCoreMessage(message) {
				select {
				case dataChan <- state.Snapshot():
				default:
				}
			}
		}
	}()

	return nil
}

func connectToF1LegacySignalR(dataChan chan LiveStreamData) error {
	hubName := `[{"name":"Streaming"}]`
	negotiateURL := fmt.Sprintf("https://livetiming.formula1.com/signalr/negotiate?clientProtocol=1.5&connectionData=%s", url.QueryEscape(hubName))

	req, err := http.NewRequest("GET", negotiateURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "BestHTTP")
	if token := f1LiveBearerToken(); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("f1 signalr negotiate returned %s (auth=%s)", resp.Status, authState())
	}

	cookies := resp.Cookies()
	var neg struct {
		ConnectionToken string `json:"ConnectionToken"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&neg); err != nil {
		return err
	}
	if neg.ConnectionToken == "" {
		return fmt.Errorf("f1 signalr negotiate returned an empty connection token")
	}

	wsURL := fmt.Sprintf("wss://livetiming.formula1.com/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken=%s&connectionData=%s",
		url.QueryEscape(neg.ConnectionToken),
		url.QueryEscape(hubName),
	)

	header := http.Header{}
	for _, cookie := range cookies {
		header.Add("Cookie", cookie.String())
	}
	header.Add("User-Agent", "BestHTTP")
	if token := f1LiveBearerToken(); token != "" {
		header.Add("Authorization", "Bearer "+token)
	}

	c, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return err
	}

	subscribeMsg := []byte(`{"H":"Streaming","M":"Subscribe","A":[["Heartbeat","TimingData","Position.z","CarData.z","DriverList","LapCount","ExtrapolatedClock","TrackStatus","RaceControlMessages","WeatherData","SessionInfo","TeamRadio","CurrentTyres","TimingAppData","TimingStats"]],"I":1}`)
	err = c.WriteMessage(websocket.TextMessage, subscribeMsg)
	if err != nil {
		return err
	}

	go func() {
		defer c.Close()
		state := NewState()

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("WS Read Error:", err)
				return
			}

			if state.ProcessMessage(message) {
				select {
				case dataChan <- state.Snapshot():
				default:
				}
			}
		}
	}()

	return nil
}

func f1LiveBearerToken() string {
	if token := os.Getenv("BOXBOX_F1_LIVE_BEARER_TOKEN"); token != "" {
		return token
	}
	return os.Getenv("F1_LIVE_BEARER_TOKEN")
}

func authState() string {
	if f1LiveBearerToken() != "" {
		return "bearer-configured"
	}
	return "no-bearer-token"
}
