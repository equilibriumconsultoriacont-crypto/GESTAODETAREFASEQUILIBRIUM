import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/"); }, []);
  return null;
}
