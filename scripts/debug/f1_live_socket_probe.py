#!/usr/bin/env python3
"""Probe the official F1 live timing sockets for GPS position topics.

This intentionally does not call OpenF1 REST. It connects directly to the F1
SignalR endpoints used by the app and reports which topics arrive.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import random
import socket
import ssl
import struct
import sys
import time
import urllib.parse
import urllib.request


RS = b"\x1e"
CORE_NEGOTIATE = "https://livetiming.formula1.com/signalrcore/negotiate?negotiateVersion=1"
CORE_WS_HOST = "livetiming.formula1.com"
LEGACY_HUB = '[{"name":"Streaming"}]'
TOPICS = [
    "Heartbeat",
    "TimingData",
    "Position",
    "Position.z",
    "CarData",
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
]


class WebSocket:
    def __init__(self, host: str, path: str, headers: dict[str, str] | None = None):
        self.host = host
        self.sock = ssl.create_default_context().wrap_socket(
            socket.create_connection((host, 443), timeout=10),
            server_hostname=host,
        )
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request_headers = {
            "Host": host,
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Key": key,
            "Sec-WebSocket-Version": "13",
            "Origin": "https://www.formula1.com",
            "User-Agent": "Mozilla/5.0",
        }
        request_headers.update(headers or {})
        lines = [f"GET {path} HTTP/1.1", *[f"{k}: {v}" for k, v in request_headers.items()], "", ""]
        self.sock.sendall("\r\n".join(lines).encode("utf-8"))
        response = self._read_http_response()
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            raise RuntimeError(response.decode("utf-8", "replace"))

    def _read_http_response(self) -> bytes:
        data = b""
        while b"\r\n\r\n" not in data:
            data += self.sock.recv(4096)
        return data

    def send_text(self, text: str) -> None:
        payload = text.encode("utf-8")
        header = bytearray([0x81])
        if len(payload) < 126:
            header.append(0x80 | len(payload))
        elif len(payload) < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", len(payload)))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", len(payload)))
        mask = random.randbytes(4) if hasattr(random, "randbytes") else os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + mask + masked)

    def recv_text(self, timeout: float = 5.0) -> str | None:
        self.sock.settimeout(timeout)
        while True:
            first = self.sock.recv(2)
            if not first:
                return None
            opcode = first[0] & 0x0F
            masked = bool(first[1] & 0x80)
            length = first[1] & 0x7F
            if length == 126:
                length = struct.unpack("!H", self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if masked else b""
            payload = self._read_exact(length)
            if masked:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if opcode == 0x8:
                return None
            if opcode == 0x9:
                self._send_pong(payload)
                continue
            if opcode == 0x1:
                return payload.decode("utf-8", "replace")

    def _send_pong(self, payload: bytes) -> None:
        self.sock.sendall(bytes([0x8A, len(payload)]) + payload)

    def _read_exact(self, n: int) -> bytes:
        chunks = []
        remaining = n
        while remaining:
            chunk = self.sock.recv(remaining)
            if not chunk:
                raise EOFError("socket closed")
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    def close(self) -> None:
        self.sock.close()


def http_json(url: str, method: str = "GET", headers: dict[str, str] | None = None) -> tuple[dict, list[str]]:
    req = urllib.request.Request(url, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=15) as resp:
        cookies = resp.headers.get_all("Set-Cookie") or []
        return json.loads(resp.read()), cookies


def core_probe(seconds: int) -> None:
    print("== SignalR Core ==")
    neg, cookies = http_json(
        CORE_NEGOTIATE,
        method="POST",
        headers={"Origin": "https://www.formula1.com", "User-Agent": "Mozilla/5.0", "Content-Length": "0"},
    )
    token = urllib.parse.quote(neg["connectionToken"], safe="")
    ws = WebSocket(
        CORE_WS_HOST,
        f"/signalrcore?id={token}",
        {"Cookie": "; ".join(cookies)} if cookies else None,
    )
    try:
        ws.send_text(json.dumps({"protocol": "json", "version": 1}, separators=(",", ":")) + RS.decode())
        print("handshake:", repr(ws.recv_text()))
        ws.send_text(
            json.dumps(
                {"type": 1, "target": "subscribe", "arguments": [TOPICS], "invocationId": "1"},
                separators=(",", ":"),
            )
            + RS.decode()
        )
        collect(ws, seconds)
    finally:
        ws.close()


def legacy_probe(seconds: int, bearer: str | None) -> None:
    print("\n== Legacy SignalR ==")
    query = urllib.parse.quote(LEGACY_HUB, safe="")
    headers = {"User-Agent": "BestHTTP"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    neg_url = f"https://livetiming.formula1.com/signalr/negotiate?clientProtocol=1.5&connectionData={query}"
    try:
        neg, cookies = http_json(neg_url, headers=headers)
    except Exception as exc:
        print("negotiate failed:", exc)
        return
    token = urllib.parse.quote(neg["ConnectionToken"], safe="")
    path = f"/signalr/connect?clientProtocol=1.5&transport=webSockets&connectionToken={token}&connectionData={query}"
    ws_headers = {"User-Agent": "BestHTTP"}
    if cookies:
        ws_headers["Cookie"] = "; ".join(cookies)
    if bearer:
        ws_headers["Authorization"] = f"Bearer {bearer}"
    ws = WebSocket(CORE_WS_HOST, path, ws_headers)
    try:
        ws.send_text(json.dumps({"H": "Streaming", "M": "Subscribe", "A": [TOPICS], "I": 1}, separators=(",", ":")))
        collect(ws, seconds)
    finally:
        ws.close()


def collect(ws: WebSocket, seconds: int) -> None:
    deadline = time.time() + seconds
    seen: dict[str, int] = {}
    while time.time() < deadline:
        try:
            message = ws.recv_text(timeout=min(5, max(1, deadline - time.time())))
        except TimeoutError:
            continue
        if not message:
            break
        for frame in message.split(RS.decode()):
            if not frame:
                continue
            try:
                payload = json.loads(frame)
            except json.JSONDecodeError:
                continue
            record_topics(payload, seen)
    print("seen topics:")
    for topic in sorted(seen):
        print(f"  {topic}: {seen[topic]}")
    if not any(topic.startswith("Position") for topic in seen):
        print("  (no Position / Position.z topics observed)")


def record_topics(payload: dict, seen: dict[str, int]) -> None:
    result = payload.get("result") or payload.get("R")
    if isinstance(result, dict):
        for topic, data in result.items():
            seen[topic] = seen.get(topic, 0) + 1
            maybe_print_position(topic, data)
    for message in payload.get("M") or []:
        args = message.get("A") or []
        if len(args) >= 2:
            topic = args[0]
            seen[topic] = seen.get(topic, 0) + 1
            maybe_print_position(topic, args[1])
    if payload.get("target") == "feed":
        args = payload.get("arguments") or []
        if len(args) >= 2:
            topic = args[0]
            seen[topic] = seen.get(topic, 0) + 1
            maybe_print_position(topic, args[1])


def maybe_print_position(topic: str, data) -> None:
    if topic in {"Position", "Position.z"}:
        text = json.dumps(data)[:600] if not isinstance(data, str) else data[:600]
        print(f"POSITION TOPIC {topic}: {text}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, default=20)
    parser.add_argument("--legacy", action="store_true", help="also probe legacy SignalR")
    args = parser.parse_args()
    core_probe(args.seconds)
    if args.legacy:
        legacy_probe(args.seconds, os.environ.get("BOXBOX_F1_LIVE_BEARER_TOKEN") or os.environ.get("F1_LIVE_BEARER_TOKEN"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
