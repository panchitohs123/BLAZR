"use client"

import { useState } from "react"
import useSWR from "swr"
import { MapPin, Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Branch } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createBranch, updateBranch, toggleBranchOpen } from "@/app/actions"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BranchesPage() {
  const { data: branches, mutate, isLoading } = useSWR<Branch[]>(
    "/api/admin?type=branches",
    fetcher
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<Branch | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formZones, setFormZones] = useState("")
  const [formIsOpen, setFormIsOpen] = useState(true)

  const openCreate = () => {
    setEditBranch(null)
    setFormName("")
    setFormAddress("")
    setFormZones("")
    setFormIsOpen(true)
    setDialogOpen(true)
  }

  const openEdit = (branch: Branch) => {
    setEditBranch(branch)
    setFormName(branch.name)
    setFormAddress(branch.address)
    setFormZones(branch.deliveryZones.join(", "))
    setFormIsOpen(branch.isOpen)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName) {
      toast.error("Please enter a branch name")
      return
    }

    const zonasDelivery = formZones
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      if (editBranch) {
        const result = await updateBranch(editBranch.id, {
          nombre: formName,
          direccion: formAddress,
          zonasDelivery,
          isOpen: formIsOpen,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Branch updated")
      } else {
        const result = await createBranch({
          nombre: formName,
          direccion: formAddress,
          zonasDelivery,
          isOpen: formIsOpen,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Branch created")
      }
      setDialogOpen(false)
      mutate()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleOpen = async (branchId: string) => {
    const branch = branches?.find((b) => b.id === branchId)
    // Optimistic update
    mutate(
      (prev) =>
        prev?.map((b) =>
          b.id === branchId ? { ...b, isOpen: !b.isOpen } : b
        ),
      false
    )
    const result = await toggleBranchOpen(branchId)
    if (result.error) {
      toast.error(result.error)
      mutate()
    } else if (branch) {
      toast.success(
        `${branch.name} is now ${branch.isOpen ? "closed" : "open"}`
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Branches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your restaurant locations
          </p>
        </div>
        <Button
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Array.isArray(branches) ? branches : []).map((branch) => (
          <Card
            key={branch.id}
            className={cn(
              "rounded-2xl bg-card border-border transition-colors cursor-pointer hover:border-primary/30",
              branch.isOpen ? "border-primary/20" : "opacity-60"
            )}
            onClick={() => openEdit(branch)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-card-foreground">
                  {branch.name}
                </CardTitle>
                <Switch
                  checked={branch.isOpen}
                  onCheckedChange={() => handleToggleOpen(branch.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Toggle ${branch.name} open/closed`}
                />
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                <MapPin className="h-3 w-3" />
                {branch.address}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    branch.isOpen
                      ? "bg-chart-3/15 text-chart-3 border-chart-3/20"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {branch.isOpen ? "Open" : "Closed"}
                </Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Delivery Zones
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {branch.deliveryZones.map((zone) => (
                    <Badge
                      key={zone}
                      variant="outline"
                      className="text-xs text-muted-foreground border-border"
                    >
                      {zone}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle
              className="text-card-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {editBranch ? "Edit Branch" : "Create Branch"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Name
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Branch name"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Address
              </Label>
              <Input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Full address"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1.5 block">
                Delivery Zones (comma-separated)
              </Label>
              <Input
                value={formZones}
                onChange={(e) => setFormZones(e.target.value)}
                placeholder="Zone 1, Zone 2, Zone 3"
                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Open</Label>
              <Switch checked={formIsOpen} onCheckedChange={setFormIsOpen} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editBranch ? (
                "Save Changes"
              ) : (
                "Create Branch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
