"""
Petstore MCP Server

Provides tools to interact with the Petstore API including:
- Searching and viewing pets
- Managing orders
- User management
"""

import asyncio
import os
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .client import PetstoreClient

# Initialize the MCP server
app = Server("petstore-mcp")

# Initialize API client
api_client = PetstoreClient()

@app.list_tools()
async def list_tools() -> List[Tool]:
    """List available tools for the Petstore API."""
    return [
        Tool(
            name="search_pets_by_status",
            description="Search for pets by their availability status (available, pending, sold)",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["available", "pending", "sold"],
                        "description": "Pet status to search for"
                    }
                },
                "required": ["status"]
            }
        ),
        Tool(
            name="search_pets_by_tags",
            description="Search for pets by tag names",
            inputSchema={
                "type": "object",
                "properties": {
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of tag names to search for"
                    }
                },
                "required": ["tags"]
            }
        ),
        Tool(
            name="get_pet_by_id",
            description="Get detailed information about a specific pet",
            inputSchema={
                "type": "object",
                "properties": {
                    "pet_id": {
                        "type": "integer",
                        "description": "ID of the pet to retrieve"
                    }
                },
                "required": ["pet_id"]
            }
        ),
        Tool(
            name="get_store_inventory",
            description="Get inventory counts by pet status (requires store_owner or admin role)",
            inputSchema={
                "type": "object",
                "properties": {
                    "auth_token": {
                        "type": "string",
                        "description": "JWT authentication token"
                    }
                },
                "required": ["auth_token"]
            }
        ),
        Tool(
            name="get_order_by_id",
            description="Get details of a specific order",
            inputSchema={
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "integer",
                        "description": "ID of the order to retrieve"
                    },
                    "auth_token": {
                        "type": "string",
                        "description": "JWT authentication token"
                    }
                },
                "required": ["order_id", "auth_token"]
            }
        ),
        Tool(
            name="place_order",
            description="Place a new order for a pet",
            inputSchema={
                "type": "object",
                "properties": {
                    "pet_id": {
                        "type": "integer",
                        "description": "ID of the pet to order"
                    },
                    "ship_date": {
                        "type": "string",
                        "description": "Shipping date in ISO format",
                        "format": "date-time"
                    },
                    "auth_token": {
                        "type": "string",
                        "description": "JWT authentication token"
                    }
                },
                "required": ["pet_id", "auth_token"]
            }
        ),
        Tool(
            name="login_user",
            description="Log in a user and get authentication token",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "Username"
                    },
                    "password": {
                        "type": "string",
                        "description": "Password"
                    }
                },
                "required": ["username", "password"]
            }
        ),
        Tool(
            name="get_user_profile",
            description="Get user profile information",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "Username to retrieve"
                    },
                    "auth_token": {
                        "type": "string",
                        "description": "JWT authentication token"
                    }
                },
                "required": ["username", "auth_token"]
            }
        ),
        Tool(
            name="create_user",
            description="Create a new user account",
            inputSchema={
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "Username for the new account"
                    },
                    "password": {
                        "type": "string",
                        "description": "Password for the new account"
                    },
                    "email": {
                        "type": "string",
                        "description": "Email address"
                    },
                    "first_name": {
                        "type": "string",
                        "description": "First name"
                    },
                    "last_name": {
                        "type": "string",
                        "description": "Last name"
                    },
                    "phone": {
                        "type": "string",
                        "description": "Phone number"
                    }
                },
                "required": ["username", "password"]
            }
        ),
        Tool(
            name="add_pet",
            description="Add a new pet to the store (requires store_owner or admin role)",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Pet name"
                    },
                    "category_name": {
                        "type": "string",
                        "description": "Category name (e.g., Dogs, Cats)"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["available", "pending", "sold"],
                        "description": "Pet status",
                        "default": "available"
                    },
                    "photo_urls": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of photo URLs"
                    },
                    "tag_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of tag names"
                    },
                    "auth_token": {
                        "type": "string",
                        "description": "JWT authentication token"
                    }
                },
                "required": ["name", "auth_token"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Handle tool calls."""
    try:
        if name == "search_pets_by_status":
            result = await api_client.search_pets_by_status(arguments["status"])
            return [TextContent(type="text", text=f"Found {len(result)} pets with status '{arguments['status']}':\\n{api_client.format_pets_list(result)}")]

        elif name == "search_pets_by_tags":
            tags = arguments["tags"]
            result = await api_client.search_pets_by_tags(tags)
            return [TextContent(type="text", text=f"Found {len(result)} pets with tags {tags}:\\n{api_client.format_pets_list(result)}")]

        elif name == "get_pet_by_id":
            result = await api_client.get_pet_by_id(arguments["pet_id"])
            if result:
                return [TextContent(type="text", text=f"Pet Details:\\n{api_client.format_pet_details(result)}")]
            else:
                return [TextContent(type="text", text="Pet not found")]

        elif name == "get_store_inventory":
            result = await api_client.get_store_inventory(arguments["auth_token"])
            if result:
                inventory_text = "\\n".join([f"{status}: {count} pets" for status, count in result.items()])
                return [TextContent(type="text", text=f"Store Inventory:\\n{inventory_text}")]
            else:
                return [TextContent(type="text", text="Failed to retrieve inventory")]

        elif name == "get_order_by_id":
            result = await api_client.get_order_by_id(arguments["order_id"], arguments["auth_token"])
            if result:
                return [TextContent(type="text", text=f"Order Details:\\n{api_client.format_order_details(result)}")]
            else:
                return [TextContent(type="text", text="Order not found or access denied")]

        elif name == "place_order":
            pet_id = arguments["pet_id"]
            ship_date = arguments.get("ship_date")
            auth_token = arguments["auth_token"]
            
            result = await api_client.place_order(pet_id, auth_token, ship_date)
            if result:
                return [TextContent(type="text", text=f"Order placed successfully:\\n{api_client.format_order_details(result)}")]
            else:
                return [TextContent(type="text", text="Failed to place order")]

        elif name == "login_user":
            result = await api_client.login_user(arguments["username"], arguments["password"])
            if result and "token" in result:
                return [TextContent(type="text", text=f"Login successful! Token: {result['token']}")]
            else:
                return [TextContent(type="text", text="Login failed - invalid credentials")]

        elif name == "get_user_profile":
            result = await api_client.get_user_profile(arguments["username"], arguments["auth_token"])
            if result:
                return [TextContent(type="text", text=f"User Profile:\\n{api_client.format_user_details(result)}")]
            else:
                return [TextContent(type="text", text="User not found or access denied")]

        elif name == "create_user":
            user_data = {
                "username": arguments["username"],
                "password": arguments["password"],
                "email": arguments.get("email"),
                "firstName": arguments.get("first_name"),
                "lastName": arguments.get("last_name"),
                "phone": arguments.get("phone")
            }
            result = await api_client.create_user(user_data)
            if result:
                return [TextContent(type="text", text=f"User created successfully:\\n{api_client.format_user_details(result)}")]
            else:
                return [TextContent(type="text", text="Failed to create user")]

        elif name == "add_pet":
            pet_data = {
                "name": arguments["name"],
                "category": {"name": arguments.get("category_name", "Uncategorized")},
                "status": arguments.get("status", "available"),
                "photoUrls": arguments.get("photo_urls", []),
                "tags": [{"name": tag} for tag in arguments.get("tag_names", [])]
            }
            result = await api_client.add_pet(pet_data, arguments["auth_token"])
            if result:
                return [TextContent(type="text", text=f"Pet added successfully:\\n{api_client.format_pet_details(result)}")]
            else:
                return [TextContent(type="text", text="Failed to add pet")]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def main():
    """Main entry point for the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())