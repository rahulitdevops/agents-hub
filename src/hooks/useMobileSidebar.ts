"use client";

import { useState, useEffect } from "react";

export function useMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [isMobile]);

  return {
    isOpen,
    isMobile,
    toggle: () => setIsOpen(!isOpen),
    close: () => setIsOpen(false),
  };
}
