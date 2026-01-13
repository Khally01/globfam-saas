'use client'

import { useEffect, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  Input,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shared-ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Wallet,
  Home,
  Car,
  TrendingUp,
  Bitcoin,
  PiggyBank,
  CreditCard,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUpDown
} from 'lucide-react'
import { assetsApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { Asset, AssetType } from '@/lib/shared-types'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),
  type: z.enum(['CASH', 'PROPERTY', 'VEHICLE', 'INVESTMENT', 'CRYPTO', 'SUPERANNUATION', 'SOCIAL_INSURANCE', 'DEBT', 'OTHER']),
  subtype: z.string().optional(),
  country: z.string().length(2, 'Country code must be 2 characters'),
  currency: z.string().length(3, 'Currency code must be 3 characters'),
  amount: z.string().min(1, 'Amount is required'),
})

type AssetForm = z.infer<typeof assetSchema>

const ASSET_TYPES = [
  { value: 'CASH', label: 'Cash/Bank Account', icon: Wallet },
  { value: 'PROPERTY', label: 'Property', icon: Home },
  { value: 'VEHICLE', label: 'Vehicle', icon: Car },
  { value: 'INVESTMENT', label: 'Investment', icon: TrendingUp },
  { value: 'CRYPTO', label: 'Cryptocurrency', icon: Bitcoin },
  { value: 'SUPERANNUATION', label: 'Superannuation', icon: PiggyBank },
  { value: 'DEBT', label: 'Debt/Loan', icon: CreditCard },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal },
] as const

const COUNTRIES = [
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'MN', name: 'Mongolia', currency: 'MNT' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'EU', name: 'European Union', currency: 'EUR' },
]

export default function AssetsPage() {
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'type' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const form = useForm<AssetForm>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      country: 'AU',
      currency: 'AUD',
      type: 'CASH'
    }
  })

  const selectedCountry = form.watch('country')

  useEffect(() => {
    fetchAssets()
  }, [])

  useEffect(() => {
    // Auto-update currency when country changes
    const country = COUNTRIES.find(c => c.code === selectedCountry)
    if (country) {
      form.setValue('currency', country.currency)
    }
  }, [selectedCountry, form])

  const fetchAssets = async () => {
    try {
      const response = await assetsApi.getAll()
      setAssets(response.data.data.assets)
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAsset = async (data: AssetForm) => {
    setCreating(true)
    try {
      await assetsApi.create(data)
      await fetchAssets()
      
      toast({
        title: 'Asset created!',
        description: 'Your asset has been added successfully.',
      })
      
      form.reset()
      setShowForm(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create asset',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteAsset = async () => {
    if (!deleteAssetId) return

    try {
      await assetsApi.delete(deleteAssetId)
      await fetchAssets()
      setDeleteAssetId(null)

      toast({
        title: 'Asset deleted',
        description: 'The asset has been removed.',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete asset',
        variant: 'destructive',
      })
    }
  }

  const handleEditClick = (asset: Asset) => {
    setEditingAsset(asset)
    setShowForm(true)
    form.reset({
      name: asset.name,
      type: asset.type,
      subtype: asset.subtype || '',
      country: asset.country?.slice(0, 2) || 'AU',
      currency: asset.currency,
      amount: asset.amount,
    })
  }

  const handleUpdateAsset = async (data: AssetForm) => {
    if (!editingAsset) return

    setCreating(true)
    try {
      await assetsApi.update(editingAsset.id, data)
      await fetchAssets()
      setEditingAsset(null)
      setShowForm(false)
      form.reset()

      toast({
        title: 'Asset updated',
        description: `${data.name} has been updated successfully.`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update asset',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const getAssetIcon = (type: AssetType) => {
    const assetType = ASSET_TYPES.find(t => t.value === type)
    return assetType?.icon || MoreHorizontal
  }

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      let comparison = 0
      if (sortBy === 'amount') {
        comparison = parseFloat(a.amount) - parseFloat(b.amount)
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy === 'type') {
        comparison = a.type.localeCompare(b.type)
      } else {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [assets, sortBy, sortOrder])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            Track your assets across multiple countries
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Asset
        </Button>
      </div>

      {/* Sorting Controls */}
      {assets.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sort by:</span>
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last Updated</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Create Asset Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</CardTitle>
            <CardDescription>
              {editingAsset ? 'Update your asset details' : 'Enter details about your asset'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(editingAsset ? handleUpdateAsset : handleCreateAsset)}>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Asset Name</label>
                  <Input
                    placeholder="e.g., ANZ Savings Account"
                    {...form.register('name')}
                    disabled={creating}
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Asset Type</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...form.register('type')}
                    disabled={creating}
                  >
                    {ASSET_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Country</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...form.register('country')}
                    disabled={creating}
                  >
                    {COUNTRIES.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Currency</label>
                  <Input
                    {...form.register('currency')}
                    disabled={true}
                    className="bg-muted"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register('amount')}
                    disabled={creating}
                  />
                  {form.formState.errors.amount && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.amount.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Subtype (Optional)</label>
                  <Input
                    placeholder="e.g., Savings, Checking"
                    {...form.register('subtype')}
                    disabled={creating}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating
                    ? (editingAsset ? 'Updating...' : 'Creating...')
                    : (editingAsset ? 'Update Asset' : 'Create Asset')
                  }
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingAsset(null)
                    form.reset()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {/* Assets Grid */}
      {assets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No assets yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first asset to track your wealth
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Asset
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedAssets.map((asset) => {
            const Icon = getAssetIcon(asset.type as AssetType)
            const amount = parseFloat(asset.amount)
            
            return (
              <Card key={asset.id} className="relative group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{asset.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {asset.subtype} • {asset.country}
                        </p>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(asset)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteAssetId(asset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold">
                      {asset.currency} {amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(asset.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Asset Summary</CardTitle>
            <CardDescription>Your wealth distribution by currency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(
                assets.reduce((acc, asset) => {
                  const amount = parseFloat(asset.amount)
                  acc[asset.currency] = (acc[asset.currency] || 0) + amount
                  return acc
                }, {} as Record<string, number>)
              ).map(([currency, total]) => (
                <div key={currency} className="flex justify-between">
                  <span className="font-medium">{currency}</span>
                  <span className="text-lg font-semibold">
                    {total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteAssetId}
        onOpenChange={() => setDeleteAssetId(null)}
        onConfirm={handleDeleteAsset}
        title="Delete Asset"
        description="This will permanently remove this asset from your portfolio. This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  )
}