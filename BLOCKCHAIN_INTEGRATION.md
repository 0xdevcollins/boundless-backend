# Soroban Smart Contract Integration

This document describes the Soroban smart contract integration for the Boundless backend, which enables project funding, milestone management, and secure fund distribution on the Stellar blockchain.

## Overview

Boundless uses Soroban smart contracts on the Stellar blockchain to manage decentralized crowdfunding projects. The backend provides endpoints, service implementations, and database schemas to support these interactions.

## Environment Configuration

Add the following environment variables to your `.env` or `.env.local` file:

```
# Stellar Network Configuration
STELLAR_NETWORK=testnet  # Options: testnet, mainnet, futurenet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
FUNDING_CONTRACT_ID=       # Contract ID for the funding contract (if pre-deployed)
PROJECT_FUNDING_CONTRACT_WASM_HASH=  # WASM hash for the contract

# Transaction Configuration
TX_TIMEOUT_SECONDS=30
MAX_TX_RETRIES=3
DEFAULT_FEE=100
DEFAULT_GAS_BUDGET=1000000

# Admin Keys (Keep these secure!)
ADMIN_SECRET_KEY=          # Secret key for the admin account
```

## API Endpoints

### Deploy New Project Contract

Creates a new Soroban smart contract for a project and initializes it with the provided funding goal and milestones.

- **URL**: `/api/blockchain/projects/deploy`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "projectId": "string",
    "fundingGoal": number,
    "milestones": [
      {
        "title": "string",
        "amount": number,
        "dueDate": "string" // ISO date format
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "contractId": "string",
      "transactionHash": "string",
      "status": "string"
    }
  }
  ```

### Fund Project

Records a funding transaction for a project.

- **URL**: `/api/blockchain/projects/:projectId/fund`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "amount": number,
    "walletAddress": "string",
    "transactionHash": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transactionHash": "string",
      "status": "string",
      "amount": number
    }
  }
  ```

### Release Milestone Funds

Releases funds for a completed milestone.

- **URL**: `/api/blockchain/projects/:projectId/milestones/:milestoneId/release`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "amount": number,
    "transactionHash": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "transactionHash": "string",
      "status": "string",
      "milestoneId": "string"
    }
  }
  ```

### Get Contract State

Retrieves the current state of a project's contract.

- **URL**: `/api/blockchain/projects/:projectId/state`
- **Method**: `GET`
- **Auth Required**: No
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "address": "string",
      "fundingGoal": number,
      "raised": number,
      "milestones": [
        {
          "id": "string",
          "amount": number,
          "released": boolean,
          "releaseDate": "string" // ISO date (optional)
        }
      ],
      "status": "string",
      "lastUpdated": "string" // ISO date
    }
  }
  ```

### Additional Endpoints

- **Get Milestone Status**: `GET /api/blockchain/projects/:projectId/milestones/:milestoneId`
- **Verify Transaction**: `GET /api/blockchain/transactions/:transactionHash`
- **Get Transaction History**: `GET /api/blockchain/projects/:projectId/transactions`

## Database Schema

The integration adds three new collections to the database:

### Contract Collection

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,
  address: string,
  network: string,
  fundingGoal: number,
  raised: number,
  status: "PENDING" | "DEPLOYED" | "FAILED" | "CANCELLED",
  deployedAt: Date,
  lastUpdated: Date
}
```

### Transaction Collection

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,
  type: "DEPLOYMENT" | "FUNDING" | "MILESTONE_RELEASE" | "REFUND",
  amount: number,
  fromAddress: string,
  toAddress: string,
  transactionHash: string,
  status: "PENDING" | "CONFIRMED" | "FAILED",
  timestamp: Date,
  confirmedAt?: Date
}
```

### Milestone Collection

```typescript
{
  _id: ObjectId,
  projectId: ObjectId,
  contractId: ObjectId,
  title: string,
  amount: number,
  dueDate: Date,
  status: "PENDING" | "COMPLETED" | "RELEASED" | "OVERDUE" | "CANCELLED",
  releaseTransaction?: ObjectId,
  releasedAt?: Date
}
```

## Handling Soroban Contract Interactions

The `ContractService` provides methods for:

1. Deploying project contracts
2. Funding projects
3. Releasing milestone funds
4. Querying contract state
5. Verifying transactions
6. Retrieving transaction history

## Security Considerations

- The admin secret key should be kept secure and not exposed in client-facing code
- All transactions are verified before processing
- Milestone release operations require authentication
- Transaction hashes are stored for audit purposes

## Error Handling

The service implements robust error handling for:

- Network issues
- Transaction failures
- Invalid contract states
- Authentication/authorization errors

## Monitoring and Maintenance

- Regular audits of contract states
- Monitoring transaction confirmations
- Handling potential network issues or downtimes 