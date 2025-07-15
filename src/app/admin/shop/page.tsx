
"use client";

import { useState, useEffect, useCallback } from "react";
import { database } from "@/lib/firebase/config";
import { ref, push as rtdbPush, serverTimestamp as rtdbServerTimestamp, onValue, off, get } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageTitle from "@/components/core/page-title";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Edit3 } from "lucide-react";
import RupeeIcon from "@/components/core/rupee-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Image from 'next/image';
import GlassCard from "@/components/core/glass-card";
import { getDisplayableBannerUrl } from '@/lib/image-helper';
import type { ShopItem, ShopOrder } from '@/types';
import Link from 'next/link';

interface ShopItemData extends ShopItem {
  salesCount: number;
}

export default function ShopManagementPage() {
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState<number | string>("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemStock, setItemStock] = useState<number | string>("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemActive, setItemActive] = useState(true);
  const [shopItems, setShopItems] = useState<ShopItemData[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const { toast } = useToast();

  const fetchShopData = useCallback(async () => {
    setIsLoadingItems(true);
    if (!database) {
      console.error("RTDB database is not initialized.");
      toast({ title: "Error", description: "Database not available.", variant: "destructive" });
      setIsLoadingItems(false);
      return;
    }
    
    const itemsRef = ref(database, "shopItems");
    const ordersRef = ref(database, "purchaseRequests");

    // Fetch all orders first to calculate sales
    const ordersSnapshot = await get(ordersRef);
    const salesCountMap = new Map<string, number>();
    if (ordersSnapshot.exists()) {
      const ordersData = ordersSnapshot.val() as Record<string, ShopOrder>;
      Object.values(ordersData).forEach(order => {
        if (order.status === 'delivered' || order.status === 'shipped') {
          salesCountMap.set(order.productId, (salesCountMap.get(order.productId) || 0) + 1);
        }
      });
    }

    // Set up a listener for shop items
    const itemsListener = onValue(itemsRef, (snapshot) => {
      const items: ShopItemData[] = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        for (const id in data) {
          items.push({ 
            id, 
            ...data[id],
            salesCount: salesCountMap.get(id) || 0,
          });
        }
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      setShopItems(items);
      setIsLoadingItems(false);
    }, (error) => {
      console.error("Error fetching shop items from RTDB:", error);
      toast({ title: "Error", description: "Failed to fetch shop items.", variant: "destructive" });
      setIsLoadingItems(false);
    });

    return itemsListener; // Return listener for cleanup

  }, [toast]);

  useEffect(() => {
    let itemsListener: ReturnType<typeof onValue> | undefined;
    fetchShopData().then(listener => {
      if (listener) {
        // This is a type assertion because the return type of onValue is complex
        itemsListener = listener as unknown as ReturnType<typeof onValue>;
      }
    });
    
    return () => {
      if (itemsListener && database) {
        const itemsRef = ref(database, "shopItems");
        off(itemsRef, 'value', itemsListener);
      }
    };
  }, [fetchShopData]);


  const handleAddItem = async () => {
    if (!database) {
      toast({
        title: "Database Error",
        description: "RTDB database is not initialized. Cannot add item.",
        variant: "destructive",
      });
      return;
    }
    if (!itemName || itemPrice === "" || !itemImageUrl.trim() || itemStock === "") {
      toast({
        title: "Missing Information",
        description: "Please fill in item name, price, stock, and provide an image URL.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingItem(true);
    try {
      const itemsRef = ref(database, "shopItems");
      await rtdbPush(itemsRef, {
        name: itemName,
        price: typeof itemPrice === 'string' ? parseFloat(itemPrice) : itemPrice,
        description: itemDescription,
        category: itemCategory,
        stock: typeof itemStock === 'string' ? parseInt(itemStock, 10) : itemStock,
        imageUrl: itemImageUrl.trim(),
        active: itemActive,
        createdAt: rtdbServerTimestamp(),
        updatedAt: rtdbServerTimestamp(),
      });

      toast({
        title: "Success",
        description: "Shop item added successfully to RTDB.",
      });

      setItemName("");
      setItemPrice("");
      setItemDescription("");
      setItemCategory("");
      setItemStock("");
      setItemImageUrl("");
      setItemActive(true);

    } catch (error) {
      console.error("Error adding shop item to RTDB:", error);
      toast({
        title: "Error Adding Item",
        description: `Failed to add shop item to RTDB. ${error instanceof Error ? error.message : 'Unknown error.'}`,
        variant: "destructive",
      });
    } finally {
      setIsAddingItem(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <PageTitle title="Shop Management" subtitle="Add, view, and edit items in your shop."/>
      <div className="flex-1 grid lg:grid-cols-2 gap-6 overflow-auto p-1">
        <GlassCard className="p-0 flex flex-col">
          <CardHeader>
            <CardTitle>Existing Items</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {isLoadingItems ? (
              <div className="flex-1 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-3 text-muted-foreground">Loading items...</p>
              </div>
            ) : shopItems.length === 0 ? (
              <p className="flex-1 text-center text-muted-foreground flex items-center justify-center">No shop items found.</p>
            ) : (
              <div className="relative flex-1">
                <ScrollArea className="absolute inset-0">
                    <Table className="min-w-[700px]">
                        <TableHeader>
                            <TableRow className="border-b-border/50 sticky top-0 bg-card/80 backdrop-blur-sm z-10">
                                <TableHead>Item</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-center">Stock</TableHead>
                                <TableHead className="text-center">Sales</TableHead>
                                <TableHead className="text-center">Active</TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {shopItems.map((item) => (
                            <TableRow key={item.id} className="border-b-border/20 hover:bg-muted/20">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Image src={getDisplayableBannerUrl(item.imageUrl, item.name)} alt={item.name} width={40} height={40} className="rounded-md object-cover" />
                                        <span className="font-medium truncate" title={item.name}>{item.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <RupeeIcon className="inline h-3.5 -mt-0.5"/> {item.price.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-center">{item.stock ?? 'N/A'}</TableCell>
                                <TableCell className="text-center font-bold text-accent">{item.salesCount}</TableCell>
                                <TableCell className="text-center">{item.active ? 'Yes' : 'No'}</TableCell>
                                <TableCell className="text-center">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/admin/shop/edit/${item.id}`}>
                                            <Edit3 className="h-3.5 w-3.5" /> <span className="sr-only sm:not-sr-only sm:ml-1.5">Edit</span>
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader>
            <CardTitle>Add New Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="itemName">Item Name</Label>
                <Input
                    id="itemName"
                    placeholder="Enter item name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="itemPrice">Price</Label>
                <Input
                    id="itemPrice"
                    type="number"
                    placeholder="Enter price"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(parseFloat(e.target.value) || '')}
                    min="0"
                />
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemDescription">Description</Label>
              <Textarea
                id="itemDescription"
                placeholder="Enter item description"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                className="bg-input/50 border-border/70 focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="itemCategory">Category</Label>
                <Input
                    id="itemCategory"
                    placeholder="e.g., Apparel, Peripherals"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="itemStock">Stock</Label>
                <Input
                    id="itemStock"
                    type="number"
                    placeholder="Enter stock quantity (e.g., 100)"
                    value={itemStock}
                    onChange={(e) => setItemStock(parseInt(e.target.value, 10) || '')}
                    min="0"
                />
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemImageUrl">Item Image URL</Label>
              <Input
                id="itemImageUrl"
                type="text"
                placeholder="Enter image URL (e.g., Google Drive share link or direct image URL)"
                value={itemImageUrl}
                onChange={(e) => setItemImageUrl(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="itemActive" className="flex flex-col">
                <span>Active</span>
                <span className="text-xs text-muted-foreground">Item will be visible in the shop if active.</span>
              </Label>
              <Switch
                id="itemActive"
                checked={itemActive}
                onCheckedChange={setItemActive}
                className="data-[state=checked]:bg-accent"
              />
            </div>
            <Button onClick={handleAddItem} disabled={isAddingItem} className="w-full md:w-auto neon-accent-bg">
                {isAddingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isAddingItem ? "Adding..." : "Add Item"}
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    </div>
  );
}
