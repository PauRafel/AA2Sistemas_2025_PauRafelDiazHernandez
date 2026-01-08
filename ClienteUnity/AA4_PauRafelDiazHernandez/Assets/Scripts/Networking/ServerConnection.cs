using Newtonsoft.Json.Linq;
using SocketIOClient;
using SocketIOClient.Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Text.Json;
using UnityEngine;

public class ServerConnection : MonoBehaviour
{
    private Queue<Action> mainThreadActions = new Queue<Action>();

    [Header("Server Settings")]
    public string serverUrlLink = "http://10.0.2.15:3000";

    public SocketIOUnity socket;
    private bool isConnected = false;

    [Header("Status")]
    public bool IsConnected => isConnected;

    [Header("Events")]
    public UnityEngine.Events.UnityEvent<JArray> OnRoomListReceived;

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
            Debug.Log("Room list received in ServerConnection");
            try
            {
                JsonElement firstElement = response.GetValue(0);
                string jsonString = firstElement.GetRawText();

                Debug.Log($"JSON string: {jsonString}");

                JArray rooms = JArray.Parse(jsonString);
                Debug.Log($"Parsed {rooms.Count} rooms");

                lock (mainThreadActions)
                {
                    mainThreadActions.Enqueue(() =>
                    {
                        OnRoomListReceived?.Invoke(rooms);
                    });
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogError($"Error: {ex.Message}");
            }
        });


        socket.OnAny((eventName, response) =>
        {
            Debug.Log($"Event received: {eventName}");
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

        try
        {
            socket.Emit("list_rooms");
            Debug.Log("Emit sent successfully");
        }
        catch (System.Exception ex)
        {
            Debug.LogError($"Error emitting: {ex.Message}");
        }
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
        lock (mainThreadActions)
        {
            while (mainThreadActions.Count > 0)
            {
                mainThreadActions.Dequeue()?.Invoke();
            }
        }

        if (Input.GetKeyDown(KeyCode.Space))
        {
            RequestRoomList();
        }

        if (Input.GetKeyDown(KeyCode.T))
        {
            Debug.Log("Sending test message...");
            socket.Emit("test_message", "Hello from Unity!");
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