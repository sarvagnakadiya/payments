import { useEffect, useState } from "react";

export interface UserProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  score: number;
  verifiedAddresses: any;
}

export function useUserProfile(fid: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fid) {
      setProfile(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/users?fids=${fid}`)
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.users?.[0]) {
          setProfile(data.users[0]);
        } else {
          setProfile(null);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fid]);

  return { profile, loading, error };
}
