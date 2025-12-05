# Petstore API Documentation

## Overview

The Swagger Petstore API v3.0 is a comprehensive pet store management system with role-based access control, order management, and user authentication.

**Base URL:** `http://localhost:3002/api/v3`

## Authentication

The API uses JWT (JSON Web Token) based authentication. Most endpoints require authentication.

### Login
```http
GET /api/v3/user/login?username={username}&password={password}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Use the token in subsequent requests:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### User Roles

- **customer**: Can view pets, place orders, manage own profile
- **store_owner**: Can manage pets, all orders, and inventory
- **admin**: Full system access including user management

## Pet Endpoints

### Search Pets by Status
```http
GET /api/v3/pet/findByStatus?status={status}
Authorization: Bearer {token}
```

**Parameters:**
- `status` (required): available | pending | sold

**Response:**
```json
[
  {
    "id": 1,
    "name": "Buddy",
    "category": {
      "id": 1,
      "name": "Dogs"
    },
    "photoUrls": ["https://example.com/photo.jpg"],
    "tags": [
      {
        "id": 1,
        "name": "Friendly"
      }
    ],
    "status": "available"
  }
]
```

### Search Pets by Tags
```http
GET /api/v3/pet/findByTags?tags={tag1,tag2}
Authorization: Bearer {token}
```

**Parameters:**
- `tags` (required): Comma-separated tag names

### Get Pet by ID
```http
GET /api/v3/pet/{petId}
Authorization: Bearer {token}
```

### Add New Pet
```http
POST /api/v3/pet
Authorization: Bearer {token}
Content-Type: application/json
```

**Permissions:** store_owner, admin

**Request Body:**
```json
{
  "name": "Fluffy",
  "category": {
    "name": "Cats"
  },
  "photoUrls": ["https://example.com/photo.jpg"],
  "tags": [
    {
      "name": "Calm"
    }
  ],
  "status": "available"
}
```

### Update Pet
```http
PUT /api/v3/pet
Authorization: Bearer {token}
Content-Type: application/json
```

**Permissions:** store_owner, admin

**Request Body:** Same as Add Pet but with `id` field

### Update Pet (Form Data)
```http
POST /api/v3/pet/{petId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Permissions:** store_owner, admin

**Request Body:**
```json
{
  "name": "Updated Name",
  "status": "sold"
}
```

### Delete Pet
```http
DELETE /api/v3/pet/{petId}
Authorization: Bearer {token}
```

**Permissions:** store_owner, admin

**Business Rule:** Cannot delete pets with active orders

### Upload Pet Image
```http
POST /api/v3/pet/{petId}/uploadImage
Authorization: Bearer {token}
Content-Type: application/json
```

**Permissions:** store_owner, admin

## Store Endpoints

### Get Inventory
```http
GET /api/v3/store/inventory
Authorization: Bearer {token}
```

**Permissions:** store_owner, admin

**Response:**
```json
{
  "available": 5,
  "pending": 2,
  "sold": 3
}
```

### Place Order
```http
POST /api/v3/store/order
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "petId": 1,
  "quantity": 1,
  "shipDate": "2024-01-15T10:00:00Z",
  "status": "placed",
  "complete": false
}
```

**Business Rules:**
- Pet must be available
- Quantity must be 1
- Pet cannot have existing active orders
- Creates order and changes pet status to pending

### Get Order by ID
```http
GET /api/v3/store/order/{orderId}
Authorization: Bearer {token}
```

**Access Control:** Customers can only view their own orders

### Update Order
```http
PUT /api/v3/store/order/{orderId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Permissions:** store_owner, admin

**Request Body:**
```json
{
  "status": "delivered",
  "complete": true
}
```

**Business Rules:**
- Cannot modify delivered orders
- Delivering order marks pet as sold

### Cancel Order
```http
DELETE /api/v3/store/order/{orderId}
Authorization: Bearer {token}
```

**Access Control:** Customers can only cancel their own orders
**Business Rules:**
- Can only cancel orders with 'placed' status
- Cancelling returns pet to available status

## User Endpoints

### Create User
```http
POST /api/v3/user
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890"
}
```

### Create Users with List
```http
POST /api/v3/user/createWithList
Content-Type: application/json
```

**Request Body:** Array of user objects

### User Login
```http
GET /api/v3/user/login?username={username}&password={password}
```

### User Logout
```http
GET /api/v3/user/logout
```

### Get User by Username
```http
GET /api/v3/user/{username}
Authorization: Bearer {token}
```

**Access Control:** Users can only view their own profile (admin can view all)

### Update User
```http
PUT /api/v3/user/{username}
Authorization: Bearer {token}
Content-Type: application/json
```

**Access Control:** Users can only update their own profile
**Role Restriction:** Only admin can change roles

### Delete User
```http
DELETE /api/v3/user/{username}
Authorization: Bearer {token}
```

**Permissions:** admin only
**Business Rule:** Cannot delete users with active orders

## State Transitions

### Order State Machine
1. **Order Creation**: Pet status: available → pending
2. **Order Delivery**: Pet status: pending → sold  
3. **Order Cancellation**: Pet status: pending → available (only for 'placed' orders)

### Pet Status Flow
- **available**: Pet can be ordered
- **pending**: Pet has an active order
- **sold**: Pet has been delivered and sold

## Error Responses

### 400 Bad Request
```json
{
  "error": "Pet is not available for purchase"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Pet not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Test Accounts

Default test accounts (password: "password"):

- **admin**: Full system access
- **storeowner**: Store owner permissions
- **customer1**: Customer account
- **customer2**: Customer account

## Business Rules Summary

1. **Authentication**: All endpoints require valid JWT token
2. **Pet Ordering**: Only available pets can be ordered
3. **Order Quantity**: Must be exactly 1 for live animals
4. **Order Ownership**: Customers can only access their own orders
5. **Pet Deletion**: Cannot delete pets with active orders
6. **User Deletion**: Cannot delete users with active orders
7. **Role Management**: Only admin can change user roles
8. **Order Modification**: Cannot modify delivered orders
9. **State Consistency**: Pet status automatically updates with order state