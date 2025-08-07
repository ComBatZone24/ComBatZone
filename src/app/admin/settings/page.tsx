
"use client";

import Link from 'next/link';
import GlassCard from '@/components/core/glass-card';
import { Settings, Ticket, Share2, Eye, Server, Link2 as LinkIconLucide, Users, ChevronRight, ShieldAlert, Tv, MousePointerClick, Gift, Palette, Youtube, Rocket, Coins, Gamepad2, ImagePlay, Cpu, Lock, Upload } from 'lucide-react';
import { settingsCategories } from '@/config/nav'; // Import from config

export default function AdminSettingsHubPage() {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <Settings className="mr-3 h-8 w-8 text-accent" /> Platform Settings
        </h1>
        <p className="text-lg text-muted-foreground">Select a category to configure platform settings.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {settingsCategories.map(cat => (
          <Link href={cat.href} key={cat.title} legacyBehavior passHref>
            <a className="block h-full">
              <GlassCard interactive className="p-6 h-full flex flex-col hover:border-accent/50 transition-colors duration-200">
                <div className="flex items-center mb-3">
                  <cat.icon className="h-7 w-7 text-accent mr-4 shrink-0" />
                  <h2 className="text-xl font-semibold text-foreground">{cat.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground flex-grow mb-4">{cat.description}</p>
                <div className="flex justify-end items-center text-sm font-medium text-accent group-hover:text-accent/80">
                  Configure <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </GlassCard>
            </a>
          </Link>
        ))}
        {/* Manually add Deployment Guide as it's a special case */}
         <Link href="/admin/deployment-guide" legacyBehavior passHref>
            <a className="block h-full">
              <GlassCard interactive className="p-6 h-full flex flex-col hover:border-accent/50 transition-colors duration-200">
                <div className="flex items-center mb-3">
                  <Upload className="h-7 w-7 text-accent mr-4 shrink-0" />
                  <h2 className="text-xl font-semibold text-foreground">Deployment Guide</h2>
                </div>
                <p className="text-sm text-muted-foreground flex-grow mb-4">Instructions to deploy your app to Vercel.</p>
                <div className="flex justify-end items-center text-sm font-medium text-accent group-hover:text-accent/80">
                  View Guide <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </GlassCard>
            </a>
          </Link>
      </div>
      <GlassCard className="mt-8 p-6 border-l-4 border-blue-500 bg-blue-500/10">
        <div className="flex items-start">
          <ShieldAlert className="h-6 w-6 text-blue-400 mr-3 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-300 mb-1">Site-wide Admin Settings</h3>
            <p className="text-sm text-blue-400/80">
              These settings categories allow for granular control over different aspects of the platform.
              Changes made in these sections can affect user experience, platform functionality, and operational parameters.
              Please review changes carefully before saving.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
