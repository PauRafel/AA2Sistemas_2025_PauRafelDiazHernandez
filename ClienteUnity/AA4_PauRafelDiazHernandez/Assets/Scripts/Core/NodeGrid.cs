using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class NodeGrid : MonoBehaviour
{
    [Serializable]
    public class Node
    {
        public enum JewelType
        {
            None = 0,
            Red = 1,
            Green = 2,
            Blue = 3,
            Yellow = 4,
            Orange = 5,
            Purple = 6,
            Shiny = 7
        }

        public int x, y;
        public JewelType type;

        public Node(JewelType type, int x, int y)
        {
            this.type = type;
            this.x = x;
            this.y = y;
        }
    }

    [Serializable]
    public class Grid
    {
        [Serializable]
        public class Column
        {
            public List<Node> nodes = new List<Node>();
        }

        public List<Column> columns = new List<Column>();

        [SerializeField]
        private int _playerId;
        public int PlayerId => _playerId;

        [SerializeField]
        private string _playerName;
        public string PlayerName => _playerName;

        public Grid(GridSetup gridSetup)
        {
            _playerId = gridSetup.playerId;
            _playerName = gridSetup.playerName;

            for (int x = 0; x < gridSetup.sizeX; x++)
            {
                columns.Add(new Column());
                for (int y = 0; y < gridSetup.sizeY; y++)
                {
                    columns[x].nodes.Add(new Node(Node.JewelType.None, x, y));
                }
            }
        }

        public Node GetNode(int x, int y)
        {
            if (x >= 0 && x < columns.Count && y >= 0 && y < columns[x].nodes.Count)
            {
                return columns[x].nodes[y];
            }
            return null;
        }
    }

    [Serializable]
    public class GridUpdate
    {
        public int playerId;
        public string playerName;
        public List<Node> updatedNodes;
    }

    [Serializable]
    public class GridSetup
    {
        public int playerId;
        public string playerName;
        public int sizeX;
        public int sizeY;
    }

    [Header("Grid Settings")]
    [SerializeField] private int gridSizeX = 6;
    [SerializeField] private int gridSizeY = 12;
    [SerializeField] private float cellSize = 1f;
    [SerializeField] private GameObject cellPrefab;

    [Header("Colors")]
    [SerializeField] private Color colorRed = Color.red;
    [SerializeField] private Color colorGreen = Color.green;
    [SerializeField] private Color colorBlue = Color.blue;
    [SerializeField] private Color colorYellow = Color.yellow;
    [SerializeField] private Color colorOrange = new Color(1f, 0.5f, 0f);
    [SerializeField] private Color colorPurple = new Color(0.5f, 0f, 1f);
    [SerializeField] private Color colorEmpty = new Color(0.1f, 0.1f, 0.1f);

    private Grid _grid;
    private GameObject[,] visualCells;

    public void SetupGrid(GridSetup gridSetup)
    {
        _grid = new Grid(gridSetup);
        gridSizeX = gridSetup.sizeX;
        gridSizeY = gridSetup.sizeY;

        CreateVisualGrid();

        Debug.Log($"Grid setup: {gridSetup.playerName} ({gridSizeX}x{gridSizeY})");
    }

    public void UpdateGrid(GridUpdate gridUpdate)
    {
        if (_grid == null)
        {
            Debug.LogWarning("Grid not initialized");
            return;
        }

        foreach (var node in gridUpdate.updatedNodes)
        {
            if (node.x >= 0 && node.x < gridSizeX && node.y >= 0 && node.y < gridSizeY)
            {
                _grid.columns[node.x].nodes[node.y].type = node.type;
                UpdateVisualCell(node.x, node.y, node.type);
            }
        }
    }

    void CreateVisualGrid()
    {
        if (visualCells != null)
        {
            for (int x = 0; x < visualCells.GetLength(0); x++)
            {
                for (int y = 0; y < visualCells.GetLength(1); y++)
                {
                    if (visualCells[x, y] != null)
                    {
                        Destroy(visualCells[x, y]);
                    }
                }
            }
        }

        visualCells = new GameObject[gridSizeX, gridSizeY];

        for (int x = 0; x < gridSizeX; x++)
        {
            for (int y = 0; y < gridSizeY; y++)
            {
                Vector3 position = new Vector3(x * cellSize, (gridSizeY - 1 - y) * cellSize, 0);

                GameObject cell;
                if (cellPrefab != null)
                {
                    cell = Instantiate(cellPrefab, transform); 
                    cell.transform.localPosition = position; 
                }
                else
                {
                    cell = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    cell.transform.parent = transform; 
                    cell.transform.localPosition = position; 
                    cell.transform.localScale = new Vector3(cellSize * 0.9f, cellSize * 0.9f, 0.1f);
                }

                cell.name = $"Cell_{x}_{y}";
                visualCells[x, y] = cell;

                SetCellColor(cell, colorEmpty);
            }
        }

        CreateGridBorder();
    }

    void UpdateVisualCell(int x, int y, Node.JewelType type)
    {
        if (visualCells == null || visualCells[x, y] == null) return;

        Color targetColor = GetColorForJewelType(type);
        SetCellColor(visualCells[x, y], targetColor);
    }

    void SetCellColor(GameObject cell, Color color)
    {
        var renderer = cell.GetComponent<Renderer>();
        if (renderer != null)
        {
            if (Application.isPlaying)
            {
                Material mat = new Material(Shader.Find("Unlit/Color"));
                mat.color = color;
                renderer.material = mat;
            }
            else
            {
                if (renderer.sharedMaterial == null || renderer.sharedMaterial.shader.name != "Unlit/Color")
                {
                    renderer.sharedMaterial = new Material(Shader.Find("Unlit/Color"));
                }
                renderer.sharedMaterial.color = color;
            }
        }
    }

    void CreateGridBorder()
    {
        LineRenderer lineRenderer = GetComponent<LineRenderer>();
        if (lineRenderer == null)
        {
            lineRenderer = gameObject.AddComponent<LineRenderer>();
        }

        lineRenderer.useWorldSpace = false;
        lineRenderer.startWidth = 0.1f;
        lineRenderer.endWidth = 0.1f;
        lineRenderer.material = new Material(Shader.Find("Sprites/Default"));
        lineRenderer.startColor = Color.white;
        lineRenderer.endColor = Color.white;

        Vector3[] borderPoints = new Vector3[5];
        borderPoints[0] = new Vector3(-cellSize * 0.5f, -cellSize * 0.5f, 0);
        borderPoints[1] = new Vector3((gridSizeX - 0.5f) * cellSize, -cellSize * 0.5f, 0);
        borderPoints[2] = new Vector3((gridSizeX - 0.5f) * cellSize, (gridSizeY - 0.5f) * cellSize, 0);
        borderPoints[3] = new Vector3(-cellSize * 0.5f, (gridSizeY - 0.5f) * cellSize, 0);
        borderPoints[4] = borderPoints[0];

        lineRenderer.positionCount = 5;
        lineRenderer.SetPositions(borderPoints);
    }

    Color GetColorForJewelType(Node.JewelType type)
    {
        switch (type)
        {
            case Node.JewelType.Red: return colorRed;
            case Node.JewelType.Green: return colorGreen;
            case Node.JewelType.Blue: return colorBlue;
            case Node.JewelType.Yellow: return colorYellow;
            case Node.JewelType.Orange: return colorOrange;
            case Node.JewelType.Purple: return colorPurple;
            default: return colorEmpty;
        }
    }

    [ContextMenu("Test Grid")]
    void TestGrid()
    {
        SetupGrid(new GridSetup
        {
            playerId = 1,
            playerName = "Test Player",
            sizeX = 6,
            sizeY = 12
        });

        GridUpdate testUpdate = new GridUpdate
        {
            playerId = 1,
            playerName = "Test Player",
            updatedNodes = new List<Node>
        {
            new Node(Node.JewelType.Red, 0, 11),
            new Node(Node.JewelType.Green, 1, 11),
            new Node(Node.JewelType.Blue, 2, 11),
            new Node(Node.JewelType.Yellow, 3, 11),
            new Node(Node.JewelType.Orange, 4, 11),
            new Node(Node.JewelType.Purple, 5, 11),
            
            new Node(Node.JewelType.Red, 0, 10),
            new Node(Node.JewelType.Blue, 2, 10),
            new Node(Node.JewelType.Green, 1, 9),
        }
        };

        UpdateGrid(testUpdate);
    }
}