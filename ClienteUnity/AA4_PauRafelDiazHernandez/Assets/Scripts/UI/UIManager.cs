using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Newtonsoft.Json.Linq;

public class UIManager : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private ServerConnection serverConnection;
    [SerializeField] private GameManager gameManager;

    [Header("UI Elements")]
    [SerializeField] private GameObject roomItemPrefab;
    [SerializeField] private Transform roomListContent;
    [SerializeField] private Button refreshButton;
    [SerializeField] private GameObject roomListPanel;

    [Header("Current State")]
    private List<GameObject> currentRoomItems = new List<GameObject>();

    void Start()
    {
        if (serverConnection == null)
            serverConnection = FindFirstObjectByType<ServerConnection>();

        if (gameManager == null)
            gameManager = FindFirstObjectByType<GameManager>();

        if (refreshButton != null)
            refreshButton.onClick.AddListener(OnRefreshButtonClick);

        StartCoroutine(WaitAndSubscribe());
    }

    System.Collections.IEnumerator WaitAndSubscribe()
    {
        while (serverConnection == null || serverConnection.socket == null)
        {
            yield return new WaitForSeconds(0.5f);
        }

        SubscribeToServerEvents();

        yield return new WaitForSeconds(1f);
        RequestRoomList();
    }

    void SubscribeToServerEvents()
    {
        if (serverConnection != null && serverConnection.OnRoomListReceived != null)
        {
            serverConnection.OnRoomListReceived.AddListener(OnRoomListReceived);
            Debug.Log("UIManager subscribed to room list events");
        }
        else
        {
            Debug.LogError("ServerConnection or OnRoomListReceived is null!");
        }
    }

    void OnRoomListReceived(JArray rooms)
    {
        Debug.Log($"UIManager received {rooms.Count} rooms");
        UpdateRoomList(rooms);
    }

    void UpdateRoomList(JArray rooms)
    {
        foreach (var item in currentRoomItems)
        {
            Destroy(item);
        }
        currentRoomItems.Clear();

        foreach (var roomToken in rooms)
        {
            CreateRoomItem(roomToken);
        }
    }

    void CreateRoomItem(JToken roomData)
    {
        if (roomItemPrefab == null || roomListContent == null) return;

        GameObject roomItem = Instantiate(roomItemPrefab, roomListContent);
        currentRoomItems.Add(roomItem);

        string roomId = roomData["roomId"]?.ToString() ?? "unknown";
        string status = roomData["status"]?.ToString() ?? "waiting";
        int playerCount = roomData["playerCount"]?.Value<int>() ?? 0;
        int spectatorCount = roomData["spectatorCount"]?.Value<int>() ?? 0;
        bool isPaused = roomData["isPaused"]?.Value<bool>() ?? false;

        var roomNameText = roomItem.transform.Find("RoomNameText")?.GetComponent<TextMeshProUGUI>();
        if (roomNameText != null)
            roomNameText.text = roomId;

        var playersText = roomItem.transform.Find("PlayersText")?.GetComponent<TextMeshProUGUI>();
        if (playersText != null)
            playersText.text = $"Jugadores: {playerCount}/2 | Espectadores: {spectatorCount}";

        var statusText = roomItem.transform.Find("StatusText")?.GetComponent<TextMeshProUGUI>();
        if (statusText != null)
        {
            string statusEmoji = status == "in_progress" ? "Juega" : "Espera";
            string pauseText = isPaused ? "" : "";
            statusText.text = $"{statusEmoji} {GetStatusText(status)}{pauseText}";

            statusText.color = status == "in_progress" ? Color.green : Color.yellow;
        }

        var spectateButton = roomItem.transform.Find("SpectateButton")?.GetComponent<Button>();
        if (spectateButton != null)
        {
            spectateButton.interactable = (status == "in_progress" || status == "waiting");

            spectateButton.onClick.AddListener(() => OnSpectateRoom(roomId));

            var buttonText = spectateButton.GetComponentInChildren<TextMeshProUGUI>();
            if (buttonText != null)
            {
                buttonText.text = status == "waiting" ? "Esperar" : "Ver Partida";
            }
        }
    }

    string GetStatusText(string status)
    {
        switch (status)
        {
            case "waiting": return "Esperando";
            case "in_progress": return "En Juego";
            case "finished": return "Finalizada";
            default: return status;
        }
    }

    void OnRefreshButtonClick()
    {
        Debug.Log("Refreshing room list...");
        RequestRoomList();
    }

    void RequestRoomList()
    {
        if (serverConnection != null)
        {
            serverConnection.RequestRoomList();
        }
    }

    void OnSpectateRoom(string roomId)
    {
        Debug.Log($"Spectating room: {roomId}");

        if (gameManager != null)
        {
            gameManager.SpectateRoom(roomId);
        }
    }
}