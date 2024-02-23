import { SyndicateClient } from '@syndicateio/syndicate-node';
import { createPublicClient, http, hexToNumber, TransactionSerializedLegacy } from 'viem';
import { polygonMumbai } from 'viem/chains';

const REQUIRED_ENV_KEYS = ['SYNDICATE_API_KEY', 'SYNDICATE_PROJECT_ID', 'CONTRACT_ADDRESS'];

REQUIRED_ENV_KEYS.forEach(key => {
  if (!process.env[key]) throw new Error(`${key} is not defined in your environment`);
});

const syndicate = new SyndicateClient({ token: process.env.SYNDICATE_API_KEY! });
const chainId = 80001;

const client = createPublicClient({ chain: polygonMumbai, transport: http() });

export const sendNFT = async (recipientAddress: string) => {
  const bodyData = {
    projectId: process.env.SYNDICATE_PROJECT_ID!,
    contractAddress: process.env.CONTRACT_ADDRESS!,
    chainId: chainId,
    functionSignature: 'mint(address account)',
    args: {
      account: recipientAddress
    }
  };

  const response = await syndicate.transact.sendTransaction(bodyData);
  if (!response.transactionId) throw new Error('No transaction ID returned from Syndicate');
  return response;
};

export const _getTransactionHash = async (transactionId: string) => {
  const response = await syndicate.wallet.getTransactionRequest(process.env.SYNDICATE_PROJECT_ID!, transactionId);

  if (response.transactionAttempts && response.transactionAttempts[0]) {
    const transactionHash = response.transactionAttempts[0].hash;
    if (transactionHash && transactionHash.startsWith('0x')) return transactionHash as TransactionSerializedLegacy;
  }
  throw new Error('No transaction hash found');
};

export const getTransactionHash = async (transactionId: string) => {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return _getTransactionHash(transactionId);
    } catch (error) {
      console.error('Error getting transaction details:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
  }

  throw new Error(`Failed to retrieve transaction hash after ${maxAttempts} attempts`);
};

async function _getTransactionTokenId(transactionHash: TransactionSerializedLegacy) {
  const transaction = await client.getTransactionReceipt({
    hash: transactionHash
  });
  if (!transaction.logs[1].topics[3]) throw new Error('No tokenId found');
  return hexToNumber(transaction.logs[1].topics[3]);
}

export const getTransactionTokenId = async (transactionHash: TransactionSerializedLegacy) => {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const tokenId = _getTransactionTokenId(transactionHash);
    if (tokenId) return tokenId;
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds
  }

  throw new Error('Failed to retrieve transaction tokenId after ${maxAttempts} attempts');
};

export const claimContract = async () => {
  const endpoint = `https://api.syndicate.io/admin/project/${process.env.SYNDICATE_PROJECT_ID}/contract/${chainId}/${process.env.CONTRACT_ADDRESS}/claim`;
  const headers = {
    Authorization: `Bearer ${process.env.SYNDICATE_API_KEY}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(endpoint, { method: 'POST', headers });
  if (!response.ok) throw new Error('Failed to claim the contract');
};

interface NFTMetadata {
  joined_date: string;
  status: string;
  tier: string;
  image: string;
  level: number;
  stamina: number;
  creator: number;
  collaborator: number;
  advisor: number;
  builder: number;
  evangelist: number;
}

export const updateNftMetadata = async (tokenId: number, metadataObject: NFTMetadata) => {
  const endpoint = `https://api.syndicate.io/token-metadata/update/${process.env.SYNDICATE_PROJECT_ID}/${chainId}/${process.env.CONTRACT_ADDRESS}/${tokenId}`;

  const bodyData = {
    content: metadataObject,
    type: 'json'
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SYNDICATE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyData)
  });

  if (!response.ok) throw new Error('Failed to update metadata');
};

export const getTokenMetadata = async (tokenId: number) => {
  const endpoint = `https://metadata.syndicate.io/${chainId}/${process.env.CONTRACT_ADDRESS}/${tokenId}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.SYNDICATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const responseData = await response.json();
  if (!response.ok) throw new Error('Failed to get metadata');
  return responseData;
};
