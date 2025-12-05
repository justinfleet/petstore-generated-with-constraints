# Petstore MCP Server

This is an MCP (Model Context Protocol) server for the Petstore API. It provides tools for LLMs to interact with the Petstore system, including searching pets, managing orders, and user operations.

## Features

- **Pet Operations**: Search pets by status or tags, view pet details, add new pets
- **Order Management**: Place orders, view order details, check inventory
- **User Management**: Login, create accounts, view profiles
- **Role-Based Access**: Supports customer, store_owner, and admin roles
- **Business Logic**: Enforces all business rules and state transitions

## Setup

1. **Install dependencies using uv:**
   ```bash
   cd mcp
   uv sync
   ```

2. **Set environment variables:**
   ```bash
   export APP_ENV=local
   export API_BASE_URL=http://localhost:3002
   ```

3. **Run the MCP server:**
   ```bash
   uv run python -m petstore_mcp.server
   ```

## Available Tools

### Pet Tools
- `search_pets_by_status` - Search pets by availability status
- `search_pets_by_tags` - Search pets by tag names  
- `get_pet_by_id` - Get detailed pet information
- `add_pet` - Add new pets (requires store_owner/admin)

### Store Tools
- `get_store_inventory` - View inventory counts (requires store_owner/admin)
- `place_order` - Place orders for pets
- `get_order_by_id` - View order details

### User Tools
- `login_user` - Authenticate and get access token
- `create_user` - Create new user accounts
- `get_user_profile` - View user profiles

## Authentication

Most operations require authentication. Use the `login_user` tool first to get an authentication token:

```json
{
  "name": "login_user",
  "arguments": {
    "username": "customer1",
    "password": "password"
  }
}
```

Then use the returned token in subsequent requests:

```json
{
  "name": "search_pets_by_status",
  "arguments": {
    "status": "available",
    "auth_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

## Test Accounts

The system comes with these test accounts (password: "password"):

- `admin` - Full system access
- `storeowner` - Pet and order management 
- `customer1` - Customer account
- `customer2` - Customer account

## Environment Configuration

- **Local Development**: Set `APP_ENV=local` and `API_BASE_URL=http://localhost:3002`
- **Production**: Set `APP_ENV=production` and `PRODUCTION_API_URL=https://your-api-domain.com`

## Error Handling

The MCP server includes comprehensive error handling:
- Authentication failures return clear error messages
- Authorization errors explain required permissions
- Business rule violations include helpful context
- Network errors are logged and reported

## Business Rules Enforced

- Only available pets can be ordered
- Orders automatically change pet status to pending
- Delivered orders mark pets as sold
- Customers can only view/cancel their own orders
- Only store staff can manage inventory and pets
- Role-based access control throughout