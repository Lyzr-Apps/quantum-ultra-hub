'use client'

import { useState, useRef } from 'react'
import { Upload, FileJson, FileText, Download, Copy, Trash2, Plus, ChevronDown, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface UploadedFile {
  id: string
  name: string
  type: 'doi' | 'url' | 'bibtex' | 'pdf'
  content: string
}

interface Paper {
  title: string
  authors: string[]
  year: number
  journal: string
  doi: string
  url: string
  abstract: string
  summary_150_words: string
}

interface ComparativeAnalysisRow {
  paper: string
  research_theme: string
  methodology: string
  key_findings: string
  research_gaps: string
  year: number
}

interface AnalysisResult {
  status: string
  metadata: {
    total_papers: number
    generated_date: string
    summary_statistics: {
      year_range: string
      research_themes: string[]
      methodologies: string[]
    }
  }
  markdown_output: string
  json_output: {
    papers: Paper[]
    comparative_analysis_table: ComparativeAnalysisRow[]
  }
  confidence: number
  processing_notes: string
  Model: string
  Temperature: number
  Status: string
}

export default function LiteratureAnalysisApp() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('markdown')
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const processFiles = async (fileList: File[]) => {
    for (const file of fileList) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        let type: 'doi' | 'url' | 'bibtex' | 'pdf' = 'pdf'

        if (file.name.endsWith('.bib') || file.type === 'text/plain') {
          type = 'bibtex'
        } else if (file.type === 'application/pdf') {
          type = 'pdf'
        } else if (content.startsWith('http')) {
          type = 'url'
        } else if (content.match(/^10\.\d+/)) {
          type = 'doi'
        }

        const newFile: UploadedFile = {
          id: `${Date.now()}-${Math.random()}`,
          name: file.name || 'Untitled',
          type,
          content,
        }

        setFiles((prev) => [...prev, newFile])
      }
      reader.readAsText(file, 'utf-8')
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const addUrl = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    const url = urlInput.trim()

    // Validate URL format
    try {
      new URL(url)
    } catch {
      console.error('Invalid URL format')
      setUrlInput('')
      return
    }

    const newFile: UploadedFile = {
      id: `${Date.now()}-${Math.random()}`,
      name: url,
      type: 'url',
      content: url,
    }

    setFiles((prev) => [...prev, newFile])
    setUrlInput('')
  }

  const generateReview = async () => {
    if (files.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const formattedInput = files.map((f) => `[${f.type.toUpperCase()}]: ${f.content}`).join('\n\n')

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Process these research materials and generate a comprehensive literature review with standardized metadata extraction, 150-word summaries per paper, and a comparative analysis table:\n\n${formattedInput}`,
          agent_id: '6901b293cb70cd01d3072e42',
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to generate review')
        return
      }

      if (!data.response) {
        setError('No response from agent')
        return
      }

      let parsed: AnalysisResult
      try {
        parsed =
          typeof data.response === 'string' ? JSON.parse(data.response) : data.response
      } catch (parseError) {
        console.error('Parse error:', parseError, 'Response:', data.response)
        setError('Failed to parse agent response')
        return
      }

      // Validate the parsed result has required fields
      if (!parsed || !parsed.metadata) {
        setError('Invalid response format - missing metadata')
        return
      }

      setResult(parsed)
    } catch (error) {
      console.error('Error generating review:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const exportMarkdown = () => {
    if (!result?.markdown_output) return
    const element = document.createElement('a')
    const file = new Blob([result.markdown_output], { type: 'text/markdown' })
    element.href = URL.createObjectURL(file)
    element.download = `literature-review-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const exportJSON = () => {
    if (!result?.json_output) return
    const element = document.createElement('a')
    const file = new Blob([JSON.stringify(result.json_output, null, 2)], {
      type: 'application/json',
    })
    element.href = URL.createObjectURL(file)
    element.download = `literature-review-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(id)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f172a' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1e293b' }}>
              <span style={{ color: '#fff' }}>Literature</span>
              <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Analysis</span>
            </h1>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Research material processor & comparative analysis tool
            </p>
          </div>

          {result && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowExportDialog(true)}
                className="border-gray-600 hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="m-6 p-4 rounded-lg border border-red-500 bg-red-900/20">
            <p style={{ color: '#fca5a5' }} className="font-medium">
              Error
            </p>
            <p style={{ color: '#fecaca' }} className="text-sm mt-1">
              {error}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setError(null)}
              className="mt-3 border-red-600 hover:bg-red-900/30"
              style={{ color: '#fca5a5' }}
            >
              Dismiss
            </Button>
          </div>
        )}

        {!result ? (
          /* Upload Zone */
          <div className="grid grid-cols-3 gap-6 p-6">
            {/* Left: Upload Area */}
            <div className="col-span-1">
              <Card className="p-6 border-gray-700 bg-gray-900">
                <h2 className="text-lg font-semibold mb-4" style={{ color: '#f1f5f9' }}>
                  Research Materials
                </h2>

                {/* Drag & Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging ? 'border-green-500 bg-green-900/10' : 'border-gray-600'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: '#84cc16' }} />
                  <p className="font-medium" style={{ color: '#f1f5f9' }}>
                    Drag & drop files here
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                    or click below
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.bib,.txt"
                    onChange={(e) => {
                      if (e.target.files) {
                        processFiles(Array.from(e.target.files))
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-gray-600 hover:bg-gray-700"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Select Files
                  </Button>
                </div>

                {/* URL Input Form */}
                <form onSubmit={addUrl} className="mt-6 space-y-3">
                  <h3 className="font-medium" style={{ color: '#f1f5f9' }}>
                    Or add web links
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://example.com/paper"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="border-gray-600 hover:bg-gray-700"
                      variant="outline"
                      disabled={!urlInput.trim()}
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Add Link
                    </Button>
                  </div>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>
                    Enter research paper URLs (DOI links, journal articles, preprints)
                  </p>
                </form>

                {/* File List */}
                {files.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium" style={{ color: '#f1f5f9' }}>
                        Uploaded Files ({files.length})
                      </h3>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium truncate" style={{ color: '#f1f5f9' }}>
                              {file.name}
                            </p>
                            <Badge
                              variant="outline"
                              className="mt-1 text-xs border-gray-600"
                              style={{
                                color:
                                  file.type === 'pdf'
                                    ? '#ef4444'
                                    : file.type === 'bibtex'
                                      ? '#3b82f6'
                                      : file.type === 'doi'
                                        ? '#84cc16'
                                        : '#8b5cf6',
                              }}
                            >
                              {file.type.toUpperCase()}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFile(file.id)}
                            className="ml-2 h-8 w-8 p-0 hover:bg-gray-700"
                          >
                            <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  className="w-full mt-6 font-medium"
                  onClick={generateReview}
                  disabled={files.length === 0 || loading}
                  style={{
                    backgroundColor: '#1e3a8a',
                    color: '#fff',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e40af'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e3a8a'
                  }}
                >
                  {loading ? 'Processing...' : 'Generate Literature Review'}
                </Button>
              </Card>
            </div>

            {/* Right: Info */}
            <div className="col-span-2">
              <Card className="p-8 border-gray-700 bg-gray-900">
                <h2 className="text-2xl font-bold mb-6" style={{ color: '#f1f5f9' }}>
                  Literature Analysis Engine
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: '#84cc16' }}>
                      Supported Formats
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
                        <FileText className="w-4 h-4" style={{ color: '#ef4444' }} />
                        <span className="text-sm" style={{ color: '#cbd5e1' }}>
                          PDF Documents
                        </span>
                      </div>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
                        <FileJson className="w-4 h-4" style={{ color: '#3b82f6' }} />
                        <span className="text-sm" style={{ color: '#cbd5e1' }}>
                          BibTeX Files
                        </span>
                      </div>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
                        <span className="text-xs font-bold" style={{ color: '#84cc16' }}>
                          DOI
                        </span>
                        <span className="text-sm" style={{ color: '#cbd5e1' }}>
                          Digital Object Identifiers
                        </span>
                      </div>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
                        <span className="text-xs font-bold" style={{ color: '#8b5cf6' }}>
                          URL
                        </span>
                        <span className="text-sm" style={{ color: '#cbd5e1' }}>
                          Web Links
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: '#84cc16' }}>
                      Processing Features
                    </h3>
                    <ul className="space-y-2 text-sm" style={{ color: '#cbd5e1' }}>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#84cc16' }} className="font-bold">
                          •
                        </span>
                        Metadata extraction (title, authors, year, DOI, journal)
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#84cc16' }} className="font-bold">
                          •
                        </span>
                        150-word abstract summaries per paper
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#84cc16' }} className="font-bold">
                          •
                        </span>
                        Comparative analysis table (theme, methodology, findings, gaps)
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#84cc16' }} className="font-bold">
                          •
                        </span>
                        Synchronized Markdown & JSON output
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: '#84cc16' }} className="font-bold">
                          •
                        </span>
                        Field normalization across all formats
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          /* Results Dashboard */
          <div className="p-6">
            {result && (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
                        Analysis Results
                      </h2>
                      <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                        {result.metadata?.total_papers ?? 0} papers analyzed •{' '}
                        {result.metadata?.generated_date ?? 'N/A'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResult(null)
                        setFiles([])
                      }}
                      className="border-gray-600 hover:bg-gray-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Analysis
                    </Button>
                  </div>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className="p-4 border-gray-700 bg-gray-900">
                    <p className="text-xs font-medium uppercase" style={{ color: '#94a3b8' }}>
                      Year Range
                    </p>
                    <p className="text-lg font-bold mt-2" style={{ color: '#84cc16' }}>
                      {result.metadata?.summary_statistics?.year_range ?? 'N/A'}
                    </p>
                  </Card>
                  <Card className="p-4 border-gray-700 bg-gray-900">
                    <p className="text-xs font-medium uppercase" style={{ color: '#94a3b8' }}>
                      Research Themes
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(result.metadata?.summary_statistics?.research_themes ?? [])
                        .slice(0, 3)
                        .map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="text-xs"
                            style={{ backgroundColor: '#1e3a8a', color: '#93c5fd' }}
                          >
                            {t}
                          </Badge>
                        ))}
                    </div>
                  </Card>
                  <Card className="p-4 border-gray-700 bg-gray-900">
                    <p className="text-xs font-medium uppercase" style={{ color: '#94a3b8' }}>
                      Methodologies
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(result.metadata?.summary_statistics?.methodologies ?? [])
                        .slice(0, 3)
                        .map((m) => (
                          <Badge
                            key={m}
                            variant="secondary"
                            className="text-xs"
                            style={{ backgroundColor: '#6b21a8', color: '#d8b4fe' }}
                          >
                            {m}
                          </Badge>
                        ))}
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* Tabs for Markdown and JSON */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="bg-gray-900 border border-gray-700">
                <TabsTrigger value="markdown" className="data-[state=active]:bg-gray-800">
                  <FileText className="w-4 h-4 mr-2" />
                  Markdown Report
                </TabsTrigger>
                <TabsTrigger value="json" className="data-[state=active]:bg-gray-800">
                  <FileJson className="w-4 h-4 mr-2" />
                  JSON Structure
                </TabsTrigger>
                <TabsTrigger value="table" className="data-[state=active]:bg-gray-800">
                  Comparative Analysis
                </TabsTrigger>
              </TabsList>

              {/* Markdown Tab */}
              <TabsContent value="markdown">
                <Card className="border-gray-700 bg-gray-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold" style={{ color: '#f1f5f9' }}>
                      Markdown Output
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(result?.markdown_output ?? '', 'markdown')}
                      className="border-gray-600 hover:bg-gray-700"
                      disabled={!result?.markdown_output}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copiedIndex === 'markdown' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <ScrollArea className="h-96 rounded-lg border border-gray-700 p-4 bg-gray-800">
                    <pre
                      className="text-xs font-mono whitespace-pre-wrap"
                      style={{ color: '#cbd5e1' }}
                    >
                      {result?.markdown_output ?? 'No markdown output available'}
                    </pre>
                  </ScrollArea>
                </Card>
              </TabsContent>

              {/* JSON Tab */}
              <TabsContent value="json">
                <Card className="border-gray-700 bg-gray-900 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold" style={{ color: '#f1f5f9' }}>
                      JSON Output
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(JSON.stringify(result?.json_output ?? {}, null, 2), 'json')
                      }
                      className="border-gray-600 hover:bg-gray-700"
                      disabled={!result?.json_output}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copiedIndex === 'json' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <ScrollArea className="h-96 rounded-lg border border-gray-700 p-4 bg-gray-800">
                    <pre
                      className="text-xs font-mono whitespace-pre-wrap"
                      style={{ color: '#cbd5e1' }}
                    >
                      {JSON.stringify(result?.json_output ?? {}, null, 2)}
                    </pre>
                  </ScrollArea>
                </Card>
              </TabsContent>

              {/* Comparative Analysis Tab */}
              <TabsContent value="table">
                <Card className="border-gray-700 bg-gray-900 p-6">
                  <h3 className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
                    Comparative Analysis Table
                  </h3>
                  <ScrollArea className="rounded-lg border border-gray-700 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-800 border-b border-gray-700">
                        <TableRow>
                          <TableHead style={{ color: '#f1f5f9' }}>Paper</TableHead>
                          <TableHead style={{ color: '#f1f5f9' }}>Theme</TableHead>
                          <TableHead style={{ color: '#f1f5f9' }}>Methodology</TableHead>
                          <TableHead style={{ color: '#f1f5f9' }}>Key Findings</TableHead>
                          <TableHead style={{ color: '#f1f5f9' }}>Research Gaps</TableHead>
                          <TableHead style={{ color: '#f1f5f9' }}>Year</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(result?.json_output?.comparative_analysis_table ?? []).map((row, idx) => (
                          <TableRow
                            key={idx}
                            className="border-b border-gray-700 hover:bg-gray-800/50"
                          >
                            <TableCell className="font-medium" style={{ color: '#cbd5e1' }}>
                              {row.paper}
                            </TableCell>
                            <TableCell style={{ color: '#cbd5e1' }}>{row.research_theme}</TableCell>
                            <TableCell style={{ color: '#cbd5e1' }}>{row.methodology}</TableCell>
                            <TableCell style={{ color: '#cbd5e1' }}>{row.key_findings}</TableCell>
                            <TableCell style={{ color: '#cbd5e1' }}>{row.research_gaps}</TableCell>
                            <TableCell style={{ color: '#cbd5e1' }}>{row.year}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Papers Details */}
            {result && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg" style={{ color: '#f1f5f9' }}>
                  Paper Summaries
                </h3>
                {(result.json_output?.papers ?? []).map((paper, idx) => (
                <Collapsible key={idx} className="border border-gray-700 rounded-lg">
                  <CollapsibleTrigger className="w-full p-4 hover:bg-gray-800 flex items-start justify-between">
                    <div className="text-left flex-1">
                      <h4 className="font-semibold" style={{ color: '#f1f5f9' }}>
                        {paper.title}
                      </h4>
                      <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                        {paper.authors.join(', ')} ({paper.year})
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" style={{ color: '#94a3b8' }} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 border-t border-gray-700 bg-gray-800/50">
                    <div className="space-y-4">
                      {paper.doi && (
                        <div>
                          <p className="text-xs uppercase font-medium" style={{ color: '#84cc16' }}>
                            DOI
                          </p>
                          <p className="text-sm break-all" style={{ color: '#cbd5e1' }}>
                            {paper.doi}
                          </p>
                        </div>
                      )}
                      {paper.journal && (
                        <div>
                          <p className="text-xs uppercase font-medium" style={{ color: '#84cc16' }}>
                            Journal
                          </p>
                          <p className="text-sm" style={{ color: '#cbd5e1' }}>
                            {paper.journal}
                          </p>
                        </div>
                      )}
                      {paper.abstract && (
                        <div>
                          <p className="text-xs uppercase font-medium" style={{ color: '#84cc16' }}>
                            Abstract
                          </p>
                          <p className="text-sm" style={{ color: '#cbd5e1' }}>
                            {paper.abstract}
                          </p>
                        </div>
                      )}
                      {paper.summary_150_words && (
                        <div>
                          <p className="text-xs uppercase font-medium" style={{ color: '#84cc16' }}>
                            150-Word Summary
                          </p>
                          <p className="text-sm" style={{ color: '#cbd5e1' }}>
                            {paper.summary_150_words}
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-gray-900 border border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#f1f5f9' }}>Export Results</DialogTitle>
            <DialogDescription style={{ color: '#94a3b8' }}>
              Download your analysis in your preferred format
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              onClick={exportMarkdown}
              className="w-full justify-start"
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 text-left"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Markdown Report (.md)
            </Button>
            <Button
              onClick={exportJSON}
              className="w-full justify-start"
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 text-left"
            >
              <Download className="w-4 h-4 mr-2" />
              Download JSON Data (.json)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
