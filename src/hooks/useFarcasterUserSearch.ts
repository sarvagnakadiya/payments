import { useState, useEffect } from "react";

export interface FarcasterUser {
  name: string;
  username: string;
  address: string;
  avatar: string;
  fid: number;
}

export function useFarcasterUserSearch() {
  const [users, setUsers] = useState<FarcasterUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Search function for Farcaster users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error("Failed to search users");
        setUsers([]);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setUsers([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      } else {
        setUsers([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setUsers([]);
  };

  return {
    users,
    isSearching,
    searchQuery,
    setSearchQuery,
    clearSearch,
  };
}
