'use client';

import { useState } from 'react';

import ChatButton from './ChatButton';
import ChatPanel from './ChatPanel';

export default function Chat() {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <ChatPanel isOpen={isOpen} />
      <ChatButton isOpen={isOpen} onClick={handleToggle} />
    </>
  );
}
