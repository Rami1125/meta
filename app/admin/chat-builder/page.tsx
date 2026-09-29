'use client';

import React from 'react';
import { VisualBranchBuilder } from '../../../src/components/Builder/VisualBranchBuilder';

export default function AdminChatBuilderPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950">
      <VisualBranchBuilder />
    </div>
  );
}
