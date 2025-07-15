
"use client";

import { useState, useEffect, useMemo } from 'react';
import { database } from '@/lib/firebase/config';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';
import PageTitle from '@/components/core/page-title';
import GlassCard from '@/components/core/glass-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, Globe } from 'lucide-react';

interface CountryStats {
  countryName: string;
  countryCode: string;
  flagUrl: string;
  userCount: number;
  cities: Record<string, number>;
}

export default function UserDemographicsPage() {
  const [demographics, setDemographics] = useState<Record<string, CountryStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAndProcessUserData = async () => {
      setIsLoading(true);
      if (!database) {
        toast({ title: "Database Error", description: "Database service not available.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        if (!snapshot.exists()) {
          setIsLoading(false);
          return;
        }

        const allUsers = snapshot.val() as Record<string, User>;
        const stats: Record<string, CountryStats> = {};

        Object.values(allUsers).forEach(user => {
          const loc = user.location;
          if (loc && loc.country_name) {
            const country = loc.country_name;
            if (!stats[country]) {
              stats[country] = {
                countryName: country,
                countryCode: loc.country_code || 'N/A',
                flagUrl: loc.country_flag || '',
                userCount: 0,
                cities: {},
              };
            }
            stats[country].userCount++;
            if (loc.city) {
              stats[country].cities[loc.city] = (stats[country].cities[loc.city] || 0) + 1;
            }
          }
        });
        
        setDemographics(stats);
      } catch (err: any) {
        toast({ title: "Fetch Error", description: "Could not load user data for analysis.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndProcessUserData();
  }, [toast]);

  const sortedCountries = useMemo(() => {
    return Object.values(demographics).sort((a, b) => b.userCount - a.userCount);
  }, [demographics]);
  
  const chartData = useMemo(() => {
      return sortedCountries.slice(0, 10).map(c => ({
          name: c.countryName,
          users: c.userCount,
      })).reverse(); // Reverse for better chart display
  }, [sortedCountries]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <p className="ml-3 text-muted-foreground">Analyzing user data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="User Demographics" subtitle="Analyze user location data from around the world." />
      
      <GlassCard>
        <h3 className="text-xl font-semibold mb-4 text-foreground">Top 10 Countries by User Count</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={80} tick={{ fill: 'hsl(var(--foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                cursor={{ fill: 'hsl(var(--accent))', fillOpacity: 0.1 }}
              />
              <Legend />
              <Bar dataKey="users" name="Users" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
             <p className="text-center text-muted-foreground py-10">Not enough data to render chart.</p>
        )}
      </GlassCard>

      <GlassCard className="p-0 flex flex-1 flex-col overflow-hidden">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <Globe className="mr-2 h-5 w-5 text-accent" /> All Countries
          </h3>
        </div>
        <div className="relative flex-1">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-center">User Count</TableHead>
                  <TableHead>Top Cities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCountries.length > 0 ? (
                  sortedCountries.map((stat) => (
                    <TableRow key={stat.countryName}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <img src={stat.flagUrl} alt={`${stat.countryName} flag`} className="w-6 h-auto rounded-sm" />
                          <span>{stat.countryName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-lg text-accent">{stat.userCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Object.entries(stat.cities)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([city, count]) => `${city} (${count})`)
                          .join(', ')}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="text-center h-24">No location data found for any users.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </GlassCard>
    </div>
  );
}
