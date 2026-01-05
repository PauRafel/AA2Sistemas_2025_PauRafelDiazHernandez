using System;
using System.Collections.Generic;
using SocketIOClient;
using SocketIOClient.Newtonsoft.Json;
using UnityEngine;
using Newtonsoft.Json.Linq;

public class ServerConnection : MonoBehaviour
{
    [Header("Server Settings")]
    public string serverUrlLink = "http://10.0.2.15:3000";

    public SocketIOUnity socket;
    private bool isConnected = false;

    [Header("Status")]
    public bool IsConnected => isConnected;

    void Start()
    {
        ConnectToServer();
    }

    void ConnectToServer()
    {
        var uri = new Uri(serverUrlLink);
        socket = new SocketIOUnity(uri);

        socket.OnConnected += (sender, e) =>
        {
            Debug.Log("socket.OnConnected");
            isConnected = true;
        };

        socket.OnDisconnected += (sender, e) =>
        {
            Debug.Log("socket.OnDisconnected");
            isConnected = false;
        };

        socket.On("error", response =>
        {
            var errorData = response.GetValue<JObject>();
            Debug.LogError($"Server error: {errorData["message"]}");
        });

        socket.On("room_list", response =>
        {
            Debug.Log("Room list received");
            var rooms = response.GetValue<JArray>();
            Debug.Log($"Total rooms: {rooms.Count}");

            foreach (var room in rooms)
            {
                Debug.Log($"  - Room: {room["roomId"]}, Status: {room["status"]}, Players: {room["playerCount"]}");
            }
        });

        socket.On("game_update", response =>
        {
            Debug.Log("Game update received");
            var update = response.GetValue<JObject>();
            Debug.Log($"Update from player {update["userId"]}: Score = {update["gameState"]["score"]}");
        });

        socket.Connect();
        Debug.Log($"Connecting to {serverUrlLink}...");
    }

    public void RequestRoomList()
    {
        if (!isConnected)
        {
            Debug.LogWarning("Not connected to server");
            return;
        }

        Debug.Log("Requesting room list...");
        socket.EmitAsync("list_rooms");
    }

    public void SpectateRoom(string roomId)
    {
        if (!isConnected)
        {
            Debug.LogWarning("Not connected to server");
            return;
        }

        Debug.Log($"Spectating room: {roomId}");
        socket.EmitAsync("spectate_room", new { roomId = roomId });
    }

    public void StopSpectating(string roomId)
    {
        if (!isConnected)
        {
            Debug.LogWarning("Not connected to server");
            return;
        }

        Debug.Log($"Stopping spectating: {roomId}");
        socket.EmitAsync("stop_spectating", new { roomId = roomId });
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            RequestRoomList();
        }
    }

    void OnDestroy()
    {
        if (socket != null)
        {
            socket.Dispose();
        }
    }
}