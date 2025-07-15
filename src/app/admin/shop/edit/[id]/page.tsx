
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import GlassCard from '@/components/core/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Save, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { database } from '@/lib/firebase/config';
import { ref, get, update, serverTimestamp } from 'firebase/database';
import Link from 'next/link';

const shopItemSchema = z.object({
  name: z.string().min(3, "Item name must be at least 3 characters."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  description: z.string().optional(),
  category: z.string().optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative."),
  imageUrl: z.string().url("Please enter a valid image URL.").or(z.literal('')),
  active: z.boolean(),
});

type ShopItemFormValues = z.infer<typeof shopItemSchema>;

export default function EditShopItemPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const itemId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const form = useForm<ShopItemFormValues>({
    resolver: zodResolver(shopItemSchema),
    defaultValues: {
      name: "",
      price: 0,
      description: "",
      category: "",
      stock: 0,
      imageUrl: "",
      active: true,
    },
  });

  const fetchItemData = useCallback(async () => {
    if (!itemId) {
      setFetchError("Invalid item ID.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const itemRef = ref(database, `shopItems/${itemId}`);
      const snapshot = await get(itemRef);

      if (snapshot.exists()) {
        const fetchedItem = snapshot.val();
        form.reset({
          name: fetchedItem.name || "",
          price: fetchedItem.price || 0,
          description: fetchedItem.description || "",
          category: fetchedItem.category || "",
          stock: fetchedItem.stock || 0,
          imageUrl: fetchedItem.imageUrl || "",
          active: fetchedItem.active !== undefined ? fetchedItem.active : true,
        });
      } else {
        setFetchError("Shop item not found.");
        toast({ title: "Not Found", description: `Item with ID ${itemId} not found.`, variant: "destructive" });
      }
    } catch (err: any) {
      setFetchError(err.message || "Could not load item data.");
      toast({ title: "Fetch Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [itemId, toast, form]);

  useEffect(() => {
    fetchItemData();
  }, [fetchItemData]);

  const onSubmit = async (data: ShopItemFormValues) => {
    setIsSubmitting(true);
    try {
      const itemRef = ref(database, `shopItems/${itemId}`);
      const updates = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      await update(itemRef, updates);
      toast({
        title: "Item Updated!",
        description: `"${data.name}" has been successfully updated.`,
        variant: "default",
        className: "bg-green-500/20 text-green-300 border-green-500/30",
      });
      router.push('/admin/shop');
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-accent" /><p className="ml-4 text-lg">Loading Item...</p></div>;
  }

  if (fetchError) {
    return (
      <GlassCard className="m-4 p-6 text-center">
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Item</h2>
        <p className="text-muted-foreground mb-4">{fetchError}</p>
        <Button variant="outline" asChild>
          <Link href="/admin/shop">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shop Management
          </Link>
        </Button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <ShoppingCart className="mr-3 h-8 w-8 text-accent" /> Edit Shop Item
          </h1>
          <p className="text-muted-foreground">Modifying: {form.getValues('name')}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/shop">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
          </Link>
        </Button>
      </div>

      <GlassCard>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="name" label="Item Name" control={form.control} />
              <FormField name="price" type="number" label="Price (Rs)" control={form.control} />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">Description</Label>
              <Textarea id="description" {...form.register('description')} className="mt-1 bg-input/50 border-border/70 focus:border-accent" />
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField name="category" label="Category" control={form.control} placeholder="e.g., Apparel" />
                <FormField name="stock" type="number" label="Stock Quantity" control={form.control} />
            </div>
            
            <FormField name="imageUrl" label="Image URL" control={form.control} placeholder="https://example.com/image.png" />
            
            <Controller
                name="active"
                control={form.control}
                render={({ field }) => (
                    <div className="flex items-center space-x-3 pt-2">
                        <Switch id="active" checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-accent" />
                        <Label htmlFor="active" className="text-md font-medium text-foreground cursor-pointer">
                            Item is Active
                        </Label>
                    </div>
                )}
            />
          
          <div className="flex justify-end pt-4">
            <Button type="submit" className="neon-accent-bg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
              Save Changes
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

// Reusable FormField component
interface FormFieldProps {
  name: keyof ShopItemFormValues;
  label: string;
  control: ReturnType<typeof useForm<ShopItemFormValues>>['control'];
  type?: string;
  placeholder?: string;
}

const FormField: React.FC<FormFieldProps> = ({ name, label, control, type = "text", placeholder }) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState: { error } }) => (
      <div>
        <Label htmlFor={name} className="text-sm font-medium text-muted-foreground">{label}</Label>
        <Input
          id={name} type={type} placeholder={placeholder}
          className="mt-1 bg-input/50 border-border/70 focus:border-accent"
          {...field}
          value={field.value || ''}
          onChange={(e) => field.onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        />
        {error && <p className="text-xs text-destructive mt-1">{error.message}</p>}
      </div>
    )}
  />
);
