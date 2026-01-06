using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json.Linq;

public class GameManager : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private ServerConnection serverConnection;
    [SerializeField] private NodeGrid player1Grid;
    [SerializeField] private NodeGrid player2Grid;

    [Header("Current Room")]
    private string currentRoomId;
    private bool isSpectating = false;

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
            Debug.Log("Spectate started");
            var data = response.GetValue<JObject>();

            OnSpectateStarted(data);
        });

        serverConnection.socket.On("game_update", response =>
        {
            var data = response.GetValue<JObject>();
            OnGameUpdate(data);
        });

        serverConnection.socket.On("game_started", response =>
        {
            Debug.Log("Game started event received");
            var data = response.GetValue<JObject>();
            OnGameStarted(data);
        });
    }

    void OnSpectateStarted(JObject data)
    {
        var roomInfo = data["roomInfo"];
        currentRoomId = roomInfo["roomId"].ToString();
        isSpectating = true;

        Debug.Log($"Now spectating room: {currentRoomId}");

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
        if (targetGrid == null) return;

        var gridData = gameState["grid"];

        var gridSetup = new NodeGrid.GridSetup
        {
            playerId = userId,
            playerName = gridData["playerName"]?.ToString() ?? $"Player {userId}",
            sizeX = 6,
            sizeY = 12
        };

        targetGrid.SetupGrid(gridSetup);

        UpdateGridFromGameState(targetGrid, gameState);
    }

    void OnGameUpdate(JObject data)
    {
        int userId = data["userId"].Value<int>();
        var gameState = data["gameState"] as JObject;

        NodeGrid targetGrid = DetermineGridForPlayer(userId);

        if (targetGrid != null)
        {
            UpdateGridFromGameState(targetGrid, gameState);
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
        if (player1Grid != null && player1Grid.GetComponent<NodeGrid>()){}

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
}