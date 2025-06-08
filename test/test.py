import requests
import concurrent.futures

BASE_URL = "http://localhost:3000"  
ENDPOINT = f"{BASE_URL}/order"
HEADERS = {"Content-Type": "application/json"}


REQ1_BODY = {
    "products": [
        {"vendorProductId": "product-1", "quantity": 2},
        {"vendorProductId": "product-3", "quantity": 4},
        {"vendorProductId": "product-5", "quantity": 9}
    ],
    "customerId": "Custoemr Beta"
}


REQ2_BODY = {
    "products": [
        {"vendorProductId": "product-1", "quantity": 2},
        {"vendorProductId": "product-3", "quantity": 4},
        {"vendorProductId": "product-5", "quantity": 19}
    ],
    "customerId": "Custoemr Alpha"
}

def send_request(label, body):
    try:
        response = requests.post(ENDPOINT, headers=HEADERS, json=body)
        print(f"{label} - Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"{label} - Error: {e}")

def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        executor.submit(send_request, "req1", REQ1_BODY)
        executor.submit(send_request, "req2", REQ2_BODY)

if __name__ == "__main__":
    main()
