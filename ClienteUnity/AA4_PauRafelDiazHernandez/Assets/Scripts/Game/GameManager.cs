using Newtonsoft.Json.Linq;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text.Json;
using TMPro;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private ServerConnection serverConnection;
    [SerializeField] private NodeGrid player1Grid;
    [SerializeField] private NodeGrid player2Grid;

    [Header("Current Room")]
    private string currentRoomId;
    private bool isSpectating = false;
    private Dictionary<int, NodeGrid> playerGridMap = new Dictionary<int, NodeGrid>();

    [Header("UI References")]
    [SerializeField] private GameObject gameViewPanel;
    [SerializeField] private GameObject roomListPanel;
    [SerializeField] private TextMeshProUGUI roomInfoText;
    [SerializeField] private TextMeshProUGUI player1Label;
    [SerializeField] private TextMeshProUGUI player2Label;

    void Start()
    {
        if (serverConnection == null)
            serverConnection = FindFirstObjectByType<ServerConnection>();

        StartCoroutine(WaitForConnection());
    }

    IEnumerator WaitForConnection()
    {
        while (serverConnection == null || serverConnection.socket == null)
        {
            yield return new WaitForSeconds(0.5f);
        }

        Debug.Log("Socket ready, subscribing to events...");
        SubscribeToServerEvents();
    }

    void SubscribeToServerEvents()
    {
        serverConnection.socket.On("spectate_started", response =>
        {
            Debug.Log("Spectate started event received");
            try
            {
                JsonElement firstElement = response.GetValue(0);
                string jsonString = firstElement.GetRawText();

                Debug.Log($"Spectate started JSON: {jsonString}");

                JObject data = JObject.Parse(jsonString);

                UnityThread.executeInUpdate(() =>
                {
                    OnSpectateStarted(data);
                });
            }
            catch (Exception ex)
            {
                Debug.LogError($"Error in spectate_started: {ex.Message}\n{ex.StackTrace}");
            }
        });

        serverConnection.socket.On("game_update", response =>
        {
            try
            {
                JsonElement firstElement = response.GetValue(0);
                string jsonString = firstElement.GetRawText();

                JObject data = JObject.Parse(jsonString);

                UnityThread.executeInUpdate(() =>
                {
                    OnGameUpdate(data);
                });
            }
            catch (Exception ex)
            {
                Debug.LogError($"Error in game_update: {ex.Message}");
            }
        });

        serverConnection.socket.On("game_started", response =>
        {
            Debug.Log("Game started event received");
            try
            {
                JsonElement firstElement = response.GetValue(0);
                string jsonString = firstElement.GetRawText();

                JObject data = JObject.Parse(jsonString);

                UnityThread.executeInUpdate(() =>
                {
                    OnGameStarted(data);
                });
            }
            catch (Exception ex)
            {
                Debug.LogError($"Error in game_started: {ex.Message}");
            }
        });

        Debug.Log("GameManager subscribed to all events");
    }

    void OnSpectateStarted(JObject data)
    {
        var roomInfo = data["roomInfo"];
        currentRoomId = roomInfo["roomId"].ToString();
        isSpectating = true;

        Debug.Log($"Now spectating room: {currentRoomId}");

        int playerCount = roomInfo["playerCount"]?.Value<int>() ?? 0;
        bool isPaused = roomInfo["isPaused"]?.Value<bool>() ?? false;
        string statusText = isPaused ? "Pausado" : "En Juego";
        UpdateRoomInfoText(currentRoomId, $"{playerCount}/2 | {statusText}");

        if (data["gameStates"] != null)
        {
            var gameStates = data["gameStates"] as JObject;
            int playerIndex = 0;

            foreach (var kvp in gameStates)
            {
                int userId = int.Parse(kvp.Key);
                var gameState = kvp.Value as JObject;

                SetupGridForPlayer(playerIndex, userId, gameState);
                playerIndex++;
            }
        }
    }

    void OnGameStarted(JObject data)
    {
        var gameStates = data["gameStates"] as JObject;
        int playerIndex = 0;

        foreach (var kvp in gameStates)
        {
            int userId = int.Parse(kvp.Key);
            var gameState = kvp.Value as JObject;

            SetupGridForPlayer(playerIndex, userId, gameState);
            playerIndex++;
        }
    }

    void SetupGridForPlayer(int playerIndex, int userId, JObject gameState)
    {
        NodeGrid targetGrid = playerIndex == 0 ? player1Grid : player2Grid;
        if (targetGrid == null)
        {
            Debug.LogWarning($"Grid for player index {playerIndex} is null");
            return;
        }

        Debug.Log($"Setting up grid {playerIndex} (userId: {userId})");
        Debug.Log($"Grid position: {targetGrid.transform.position}");
        Debug.Log($"Grid local position: {targetGrid.transform.localPosition}");

        var gridData = gameState["grid"];
        string playerName = gridData["playerName"]?.ToString() ?? $"Player {userId}";

        var gridSetup = new NodeGrid.GridSetup
        {
            playerId = userId,
            playerName = playerName,
            sizeX = 6,
            sizeY = 12
        };

        targetGrid.SetupGrid(gridSetup);

        playerGridMap[userId] = targetGrid;

        UpdatePlayerLabel(targetGrid, playerName);

        Debug.Log($"Grid {playerIndex} setup for user {userId} ({playerName})");

        UpdateGridFromGameState(targetGrid, gameState);
    }

    void UpdatePlayerLabel(NodeGrid grid, string playerName)
    {
        if (grid == player1Grid && player1Label != null)
        {
            player1Label.text = playerName;
            player1Label.gameObject.SetActive(true);
        }
        else if (grid == player2Grid && player2Label != null)
        {
            player2Label.text = playerName;
            player2Label.gameObject.SetActive(true);
        }
    }

    void OnGameUpdate(JObject data)
    {
        Debug.Log("Game update received in GameManager");

        int userId = data["userId"].Value<int>();
        var gameState = data["gameState"] as JObject;

        Debug.Log($"  - User ID: {userId}");
        Debug.Log($"  - Score: {gameState["score"]}");

        NodeGrid targetGrid = DetermineGridForPlayer(userId);

        if (targetGrid != null)
        {
            Debug.Log($"  - Updating grid for player {userId}");
            UpdateGridFromGameState(targetGrid, gameState);
        }
        else
        {
            Debug.LogWarning($"  - No grid found for player {userId}");
        }
    }

    void UpdateGridFromGameState(NodeGrid grid, JObject gameState)
    {
        var gridData = gameState["grid"];

        var gridUpdate = new NodeGrid.GridUpdate
        {
            playerId = gridData["playerId"].Value<int>(),
            playerName = gridData["playerName"]?.ToString() ?? "",
            updatedNodes = new List<NodeGrid.Node>()
        };

        var updatedNodes = gridData["updatedNodes"] as JArray;

        foreach (var nodeToken in updatedNodes)
        {
            var node = new NodeGrid.Node(
                (NodeGrid.Node.JewelType)nodeToken["type"].Value<int>(),
                nodeToken["x"].Value<int>(),
                nodeToken["y"].Value<int>()
            );
            gridUpdate.updatedNodes.Add(node);
        }

        grid.UpdateGrid(gridUpdate);
    }

    NodeGrid DetermineGridForPlayer(int userId)
    {
        if (playerGridMap.ContainsKey(userId))
        {
            Debug.Log($"Found grid for user {userId}");
            return playerGridMap[userId];
        }

        Debug.LogWarning($"No grid mapped for user {userId}");

        return player1Grid;
    }

    public void SpectateRoom(string roomId)
    {
        serverConnection.SpectateRoom(roomId);
    }

    public void StopSpectating()
    {
        if (isSpectating && !string.IsNullOrEmpty(currentRoomId))
        {
            serverConnection.StopSpectating(currentRoomId);
            currentRoomId = null;
            isSpectating = false;
        }
    }

    public void OnSpectateRoomUI(string roomId)
    {
        Debug.Log($"UI: Starting spectate for room {roomId}");

        if (roomListPanel != null)
            roomListPanel.SetActive(false);

        if (gameViewPanel != null)
            gameViewPanel.SetActive(true);

        UpdateRoomInfoText(roomId, "Conectando...");
    }

    public void OnStopSpectatingUI()
    {
        Debug.Log("Stopping spectating from UI");
        StopSpectating();

        if (player1Label != null) player1Label.gameObject.SetActive(false);
        if (player2Label != null) player2Label.gameObject.SetActive(false);

        if (gameViewPanel != null)
            gameViewPanel.SetActive(false);

        if (roomListPanel != null)
            roomListPanel.SetActive(true);
    }

    void UpdateRoomInfoText(string roomId, string status)
    {
        if (roomInfoText != null)
        {
            roomInfoText.text = $"Sala: {roomId} | {status}";
        }
    }
}