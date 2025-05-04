import { StrKey } from "@stellar/stellar-sdk";

export const isValidStellarAddress = (address: string): boolean => {
  return StrKey.isValidEd25519PublicKey(address);
};
