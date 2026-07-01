import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { SEARCH_EVENT } from "../components/layout/TopHeader";

export function useTopHeaderSearch(): [string, Dispatch<SetStateAction<string>>] {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleSearch = (event: Event) => {
      setSearch((event as CustomEvent<string>).detail || "");
    };

    window.addEventListener(SEARCH_EVENT, handleSearch);
    return () => window.removeEventListener(SEARCH_EVENT, handleSearch);
  }, []);

  return [search, setSearch];
}
