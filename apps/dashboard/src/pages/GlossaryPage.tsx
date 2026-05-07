import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2, Loader as Loader2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import {
  getGlossaries,
  createGlossary,
  deleteGlossary,
  addGlossaryTerm,
  removeGlossaryTerm,
  type TranslationGlossary,
} from "../api/translation";
import { ConfirmDialog } from "../components/ConfirmDialog";

export default function GlossaryPage() {
  const { session } = useAuth();
  const siteId = session?.activeSite?.id ?? null;
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedGlossaryId, setExpandedGlossaryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // New term form state
  const [newSourceTerm, setNewSourceTerm] = useState("");
  const [newTargetTerm, setNewTargetTerm] = useState("");
  const [newSourceLocale, setNewSourceLocale] = useState("en");
  const [newTargetLocale, setNewTargetLocale] = useState("");

  const { data: glossaries = [], isLoading } = useQuery({
    queryKey: ["translation", "glossaries", siteId],
    queryFn: () => getGlossaries(siteId ?? undefined),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: () => createGlossary({ name: newName, siteId: siteId ?? undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translation", "glossaries"] });
      setShowCreate(false);
      setNewName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGlossary(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translation", "glossaries"] });
      setDeleteTarget(null);
    },
  });

  const addTermMutation = useMutation({
    mutationFn: (glossaryId: string) =>
      addGlossaryTerm(glossaryId, {
        sourceTerm: newSourceTerm,
        targetTerm: newTargetTerm,
        sourceLocale: newSourceLocale,
        targetLocale: newTargetLocale,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translation", "glossaries"] });
      setNewSourceTerm("");
      setNewTargetTerm("");
      setNewTargetLocale("");
    },
  });

  const removeTermMutation = useMutation({
    mutationFn: (termId: string) => removeGlossaryTerm(termId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translation", "glossaries"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Translation Glossary</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define brand terms, property names, and hospitality vocabulary for consistent translations.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New glossary
        </button>
      </div>

      {/* Create glossary form */}
      {showCreate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Create glossary</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && createMutation.mutate()}
              placeholder="e.g. Brand Terms, Room Types..."
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Glossaries */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-sm text-gray-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading glossaries...
        </div>
      ) : glossaries.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <BookOpen className="h-8 w-8 text-gray-200" />
          <p className="mt-3 text-sm text-gray-500">No glossaries yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Create a glossary to ensure brand terms translate consistently.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {glossaries.map((glossary) => (
            <GlossaryCard
              key={glossary.id}
              glossary={glossary}
              expanded={expandedGlossaryId === glossary.id}
              onToggle={() =>
                setExpandedGlossaryId(
                  expandedGlossaryId === glossary.id ? null : glossary.id,
                )
              }
              onDelete={() => setDeleteTarget(glossary.id)}
              onAddTerm={() => addTermMutation.mutate(glossary.id)}
              onRemoveTerm={(termId) => removeTermMutation.mutate(termId)}
              newSourceTerm={newSourceTerm}
              newTargetTerm={newTargetTerm}
              newSourceLocale={newSourceLocale}
              newTargetLocale={newTargetLocale}
              setNewSourceTerm={setNewSourceTerm}
              setNewTargetTerm={setNewTargetTerm}
              setNewSourceLocale={setNewSourceLocale}
              setNewTargetLocale={setNewTargetLocale}
              isAddPending={addTermMutation.isPending}
              isRemovePending={removeTermMutation.isPending}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete glossary"
        message="This will permanently delete the glossary and all its terms. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function GlossaryCard({
  glossary,
  expanded,
  onToggle,
  onDelete,
  onAddTerm,
  onRemoveTerm,
  newSourceTerm,
  newTargetTerm,
  newSourceLocale,
  newTargetLocale,
  setNewSourceTerm,
  setNewTargetTerm,
  setNewSourceLocale,
  setNewTargetLocale,
  isAddPending,
  isRemovePending,
}: {
  glossary: TranslationGlossary;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddTerm: () => void;
  onRemoveTerm: (termId: string) => void;
  newSourceTerm: string;
  newTargetTerm: string;
  newSourceLocale: string;
  newTargetLocale: string;
  setNewSourceTerm: (v: string) => void;
  setNewTargetTerm: (v: string) => void;
  setNewSourceLocale: (v: string) => void;
  setNewTargetLocale: (v: string) => void;
  isAddPending: boolean;
  isRemovePending: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 text-left"
        >
          <BookOpen className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{glossary.name}</p>
            <p className="text-xs text-gray-500">{glossary.terms.length} terms</p>
          </div>
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Delete glossary"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {glossary.terms.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="py-2 pr-4 font-semibold">Source</th>
                    <th className="py-2 pr-4 font-semibold">Target</th>
                    <th className="py-2 pr-4 font-semibold">Locales</th>
                    <th className="py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {glossary.terms.map((term) => (
                    <tr key={term.id}>
                      <td className="py-2 pr-4 font-medium text-gray-900">{term.sourceTerm}</td>
                      <td className="py-2 pr-4 text-gray-700">{term.targetTerm}</td>
                      <td className="py-2 pr-4 text-xs text-gray-500">
                        {term.sourceLocale.toUpperCase()} → {term.targetLocale.toUpperCase()}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => onRemoveTerm(term.id)}
                          disabled={isRemovePending}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add term form */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-600">Add term</p>
            <div className="grid gap-2 sm:grid-cols-5">
              <input
                type="text"
                value={newSourceTerm}
                onChange={(e) => setNewSourceTerm(e.target.value)}
                placeholder="Source term"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={newTargetTerm}
                onChange={(e) => setNewTargetTerm(e.target.value)}
                placeholder="Target term"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={newSourceLocale}
                onChange={(e) => setNewSourceLocale(e.target.value)}
                placeholder="en"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              />
              <input
                type="text"
                value={newTargetLocale}
                onChange={(e) => setNewTargetLocale(e.target.value)}
                placeholder="es"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              />
              <button
                onClick={onAddTerm}
                disabled={!newSourceTerm.trim() || !newTargetTerm.trim() || !newTargetLocale.trim() || isAddPending}
                className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
              >
                {isAddPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
