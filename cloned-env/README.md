# Petstore Fleet Environment

A complete Fleet environment for the Swagger Petstore API with comprehensive business logic, authentication, and role-based access control.

## 🚀 Quick Start

1. **Clone and setup:**
   ```bash
   git clone <repository>
   cd petstore-fleet
   pnpm install
   ```

2. **Start development environment:**
   ```bash
   pnpm dev
   ```

   This starts:
   - API Server on http://localhost:3002
   - MCP Server for LLM interactions

3. **Test the API:**
   ```bash
   curl http://localhost:3002/health
   ```

## 📁 Project Structure

```
petstore-fleet/
├── data/
│   ├── schema.sql              # Database schema
│   └── seed.db                 # Sample data
├── server/                     # HTTP API Server
│   ├── src/
│   │   ├── routes/
│   │   │   ├── pets.ts        # Pet management
│   │   │   ├── store.ts       # Orders & inventory
│   │   │   └── user.ts        # User management
│   │   ├── lib/
│   │   │   └── db.ts          # Database connection
│   │   └── index.ts           # Main server
│   ├── package.json
│   └── tsconfig.json
├── mcp/                       # MCP Server (Python)
│   ├── src/petstore_mcp/
│   │   ├── server.py         # MCP implementation
│   │   └── client.py         # API client
│   ├── pyproject.toml
│   └── README.md
├── mprocs.yaml               # Multi-process configuration
└── README.md
```

## 🔐 Authentication & Authorization

### User Roles
- **customer**: View pets, place orders, manage own profile
- **store_owner**: Manage pets, all orders, inventory
- **admin**: Full system access including user management

### Test Accounts
All accounts use password: `"password"`

```bash
# Login as customer
curl -X GET "http://localhost:3002/api/v3/user/login?username=customer1&password=password"

# Login as store owner  
curl -X GET "http://localhost:3002/api/v3/user/login?username=storeowner&password=password"

# Login as admin
curl -X GET "http://localhost:3002/api/v3/user/login?username=admin&password=password"
```

## 🔄 Business Logic & State Transitions

### Order Workflow
1. **Place Order**: Pet status changes from `available` → `pending`
2. **Approve Order**: Store owner changes order status to `approved`
3. **Deliver Order**: Order status → `delivered`, Pet status → `sold`
4. **Cancel Order**: Only `placed` orders can be cancelled, Pet status → `available`

### Validation Rules
- ✅ Only `available` pets can be ordered
- ✅ Quantity must be exactly 1 for live animals
- ✅ Pets cannot have multiple active orders
- ✅ Cannot delete pets/users with active orders
- ✅ Cannot modify `delivered` orders
- ✅ Role-based endpoint access control

## 🛠 API Examples

### Search Available Pets
```bash
# Get auth token first
TOKEN=$(curl -s "http://localhost:3002/api/v3/user/login?username=customer1&password=password" | jq -r '.token')

# Search pets
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:3002/api/v3/pet/findByStatus?status=available"
```

### Place Order
```bash
curl -X POST "http://localhost:3002/api/v3/store/order" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "petId": 1,
       "quantity": 1,
       "shipDate": "2024-01-15T10:00:00Z"
     }'
```

### Add Pet (Store Owner)
```bash
OWNER_TOKEN=$(curl -s "http://localhost:3002/api/v3/user/login?username=storeowner&password=password" | jq -r '.token')

curl -X POST "http://localhost:3002/api/v3/pet" \
     -H "Authorization: Bearer $OWNER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Max",
       "category": {"name": "Dogs"},
       "status": "available",
       "photoUrls": ["https://example.com/max.jpg"],
       "tags": [{"name": "Friendly"}, {"name": "Trained"}]
     }'
```

## 🤖 MCP Server Usage

The MCP server provides LLM-friendly tools for API interaction:

```bash
# Start MCP server
cd mcp
uv run python -m petstore_mcp.server
```

### Available MCP Tools
- `login_user` - Authenticate and get access token
- `search_pets_by_status` - Find pets by availability
- `search_pets_by_tags` - Find pets by tag names
- `get_pet_by_id` - Get detailed pet information
- `place_order` - Place orders for pets
- `get_store_inventory` - View inventory (store staff only)
- `add_pet` - Add new pets (store staff only)
- `create_user` - Create new user accounts

## 🗄 Database

Uses SQLite with:
- WAL mode enabled for better concurrency
- Foreign key constraints enforced
- Automatic timestamp updates
- Rich sample data with 6 pets, 4 users, 2 orders

### Key Tables
- `users` - User accounts with role-based access
- `pets` - Pet inventory with categories and tags
- `orders` - Order tracking with state management
- `categories` - Pet categories (Dogs, Cats, Birds, Fish)
- `tags` - Pet tags (Friendly, Energetic, Calm, etc.)

## 🔧 Development

### Requirements
- Node.js 20+
- pnpm 9.15.1
- Python 3.11+ (for MCP server)
- uv (Python package manager)

### Environment Variables
```bash
# Server configuration
PORT=3002
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Database path (optional)
DATABASE_PATH=/path/to/database.sqlite
ENV_DB_DIR=/path/to/data/directory

# MCP configuration  
APP_ENV=local
API_BASE_URL=http://localhost:3002
```

### Scripts
```bash
pnpm dev                    # Start development servers
pnpm --filter server build # Build server
pnpm --filter server start # Start production server
```

## 🚢 Deployment

### Docker
```bash
docker build -t petstore-fleet .
docker run -p 3002:3002 -e JWT_SECRET="production-secret" petstore-fleet
```

### Manual Deployment
1. Build the application: `pnpm --filter server build`
2. Copy `dist/`, `data/`, `package.json` to server
3. Install production dependencies: `pnpm install --prod`
4. Set environment variables
5. Start: `pnpm --filter server start`

## 🧪 Testing

The environment includes comprehensive business logic validation:

- ✅ Authentication & authorization tests
- ✅ State transition validation
- ✅ Business rule enforcement
- ✅ Error handling verification
- ✅ Role-based access control

## 📚 Documentation

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [MCP Documentation](./mcp/README.md) - MCP server usage guide

## 🎯 Features

- **Complete Business Logic**: All constraints and validations implemented
- **Role-Based Security**: Fine-grained access control
- **State Management**: Automatic status transitions
- **Error Handling**: Comprehensive validation and error responses
- **Developer Experience**: Type-safe TypeScript with proper tooling
- **Production Ready**: Docker support, health checks, logging
- **LLM Integration**: MCP server for AI assistant interactions

## 🐛 Troubleshooting

### Common Issues

1. **Port 3002 in use**: Change PORT in mprocs.yaml and restart
2. **Database locked**: Stop all processes and restart
3. **Auth failures**: Check JWT_SECRET environment variable
4. **Permission denied**: Verify user role and token validity

### Debug Mode
```bash
DEBUG=* pnpm dev  # Verbose logging
```

For more issues, check the application logs or create an issue in the repository.