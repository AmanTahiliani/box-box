package live

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
)

// ConnectToF1LiveTiming negotiates with the official F1 SignalR hub, subscribes
// to timing topics, and sends defensive snapshots on dataChan until the
// connection closes.
func ConnectToF1LiveTiming(dataChan chan LiveStreamData) error {
	hubName := `[{"name":"Streaming"}]`
	negotiateURL := fmt.Sprintf("https://livetiming.formula1.com/signalr/negotiate?clientProtocol=1.5&connectionData=%s", url.QueryEscape(hubName))

	req, err := http.NewRequest("GET", negotiateURL, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	cookies := resp.Cookies()
	defer resp.Body.Close()

	var neg struct {
		ConnectionToken string `json:"ConnectionToken"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&neg); err != nil {
		return err
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

	c, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return err
	}

	subscribeMsg := []byte(`{"H":"Streaming","M":"Subscribe","A":[["Heartbeat","TimingData","DriverList","LapCount","ExtrapolatedClock","TrackStatus","RaceControlMessages","WeatherData","SessionInfo","CurrentTyres","TimingAppData","TimingStats"]],"I":1}`)
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
