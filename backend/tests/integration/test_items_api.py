from fastapi.testclient import TestClient


def test_health_and_status(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/status").json()["status"] == "operational"


def test_create_then_list_item(client: TestClient) -> None:
    response = client.post(
        "/api/v1/items", json={"name": "Integration item", "description": "Persisted"}
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Integration item"
    listed = client.get("/api/v1/items")
    assert listed.status_code == 200
    assert [item["name"] for item in listed.json()] == ["Integration item"]


def test_duplicate_item_returns_structured_conflict(client: TestClient) -> None:
    payload = {"name": "Unique item"}
    assert client.post("/api/v1/items", json=payload).status_code == 201

    duplicate = client.post("/api/v1/items", json=payload)

    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "duplicate_item"
