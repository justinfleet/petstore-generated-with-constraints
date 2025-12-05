"""
Petstore API Client

Handles HTTP requests to the Petstore API server.
"""

import os
import httpx
from typing import Dict, List, Optional, Any
import json

class PetstoreClient:
    """Client for interacting with the Petstore API."""
    
    def __init__(self):
        """Initialize the API client."""
        # Determine API base URL based on environment
        env = os.getenv("APP_ENV", "local")
        if env == "local":
            self.base_url = os.getenv("API_BASE_URL", "http://localhost:3002")
        else:
            # In production, you might get this from another env var
            self.base_url = os.getenv("PRODUCTION_API_URL", "https://api.petstore.example.com")
        
        self.timeout = 30.0
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        auth_token: Optional[str] = None,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Make HTTP request to the API."""
        url = f"{self.base_url}/api/v3{endpoint}"
        headers = {}
        
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data
                )
                
                if response.status_code == 200 or response.status_code == 201:
                    return response.json()
                elif response.status_code == 404:
                    return None
                else:
                    print(f"API request failed: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            print(f"Request error: {e}")
            return None
    
    async def search_pets_by_status(self, status: str, auth_token: str = None) -> List[Dict]:
        """Search for pets by status."""
        # This endpoint requires authentication based on business requirements
        if not auth_token:
            # For demo purposes, try to get a default token
            # In practice, this would require proper authentication
            return []
            
        result = await self._make_request("GET", "/pet/findByStatus", auth_token, {"status": status})
        return result or []
    
    async def search_pets_by_tags(self, tags: List[str], auth_token: str = None) -> List[Dict]:
        """Search for pets by tags."""
        if not auth_token:
            return []
            
        tags_param = ",".join(tags)
        result = await self._make_request("GET", "/pet/findByTags", auth_token, {"tags": tags_param})
        return result or []
    
    async def get_pet_by_id(self, pet_id: int, auth_token: str = None) -> Optional[Dict]:
        """Get a specific pet by ID."""
        if not auth_token:
            return None
            
        return await self._make_request("GET", f"/pet/{pet_id}", auth_token)
    
    async def get_store_inventory(self, auth_token: str) -> Optional[Dict]:
        """Get store inventory (requires store_owner or admin role)."""
        return await self._make_request("GET", "/store/inventory", auth_token)
    
    async def get_order_by_id(self, order_id: int, auth_token: str) -> Optional[Dict]:
        """Get order details by ID."""
        return await self._make_request("GET", f"/store/order/{order_id}", auth_token)
    
    async def place_order(self, pet_id: int, auth_token: str, ship_date: Optional[str] = None) -> Optional[Dict]:
        """Place a new order for a pet."""
        order_data = {
            "petId": pet_id,
            "quantity": 1,
            "status": "placed",
            "complete": False
        }
        
        if ship_date:
            order_data["shipDate"] = ship_date
            
        return await self._make_request("POST", "/store/order", auth_token, json_data=order_data)
    
    async def login_user(self, username: str, password: str) -> Optional[Dict]:
        """Login user and get authentication token."""
        return await self._make_request("GET", "/user/login", params={"username": username, "password": password})
    
    async def get_user_profile(self, username: str, auth_token: str) -> Optional[Dict]:
        """Get user profile information."""
        return await self._make_request("GET", f"/user/{username}", auth_token)
    
    async def create_user(self, user_data: Dict) -> Optional[Dict]:
        """Create a new user account."""
        return await self._make_request("POST", "/user", json_data=user_data)
    
    async def add_pet(self, pet_data: Dict, auth_token: str) -> Optional[Dict]:
        """Add a new pet to the store."""
        return await self._make_request("POST", "/pet", auth_token, json_data=pet_data)
    
    def format_pets_list(self, pets: List[Dict]) -> str:
        """Format a list of pets for display."""
        if not pets:
            return "No pets found."
        
        formatted = []
        for pet in pets:
            category = pet.get("category", {}).get("name", "Unknown") if pet.get("category") else "Unknown"
            tags = ", ".join([tag.get("name", "") for tag in pet.get("tags", [])])
            formatted.append(f"• {pet.get('name', 'Unnamed')} (ID: {pet.get('id')}) - {category} - Status: {pet.get('status')} - Tags: {tags or 'None'}")
        
        return "\\n".join(formatted)
    
    def format_pet_details(self, pet: Dict) -> str:
        """Format pet details for display."""
        category = pet.get("category", {}).get("name", "Unknown") if pet.get("category") else "Unknown"
        tags = ", ".join([tag.get("name", "") for tag in pet.get("tags", [])])
        photos = ", ".join(pet.get("photoUrls", []))
        
        return f"""Name: {pet.get('name', 'Unnamed')}
ID: {pet.get('id')}
Category: {category}
Status: {pet.get('status')}
Tags: {tags or 'None'}
Photos: {photos or 'None'}"""
    
    def format_order_details(self, order: Dict) -> str:
        """Format order details for display."""
        return f"""Order ID: {order.get('id')}
Pet ID: {order.get('petId')}
Quantity: {order.get('quantity')}
Status: {order.get('status')}
Ship Date: {order.get('shipDate', 'Not set')}
Complete: {order.get('complete', False)}"""
    
    def format_user_details(self, user: Dict) -> str:
        """Format user details for display."""
        return f"""Username: {user.get('username')}
Name: {user.get('firstName', '')} {user.get('lastName', '')}
Email: {user.get('email', 'Not provided')}
Phone: {user.get('phone', 'Not provided')}
Role: {user.get('role', 'customer')}
Status: {user.get('userStatus', 1)}"""