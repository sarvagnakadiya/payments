import { useState, useEffect, useCallback } from "react";

export interface FundRequest {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  overrideChain: string | null;
  overrideToken: string | null;
  overrideAddress: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  sender: {
    id: string;
    username: string;
    fid: string | null;
  };
  receiver: {
    id: string;
    username: string;
    fid: string | null;
  };
}

export function useFundRequests(userId?: string, type?: "sent" | "received") {
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFundRequests = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId,
        ...(type && { type }),
      });

      const response = await fetch(`/api/fund-requests?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch fund requests");
      }

      const data = await response.json();
      setFundRequests(data.fundRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [userId, type]);

  const updateRequestStatus = async (
    requestId: string,
    status: FundRequest["status"]
  ) => {
    try {
      const response = await fetch(`/api/fund-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update request status");
      }

      // Refresh the fund requests after update
      await fetchFundRequests();

      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update request status"
      );
      return false;
    }
  };

  useEffect(() => {
    fetchFundRequests();
  }, [fetchFundRequests]);

  return {
    fundRequests,
    isLoading,
    error,
    refetch: fetchFundRequests,
    updateRequestStatus,
  };
}
