import { useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ImageIcon,
  ItalicIcon,
  Link2OffIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  RedoIcon,
  RemoveFormattingIcon,
  TableIcon,
  UnderlineIcon,
  UndoIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Dok } from '@spjan/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { pesanGalat } from '@/lib/format'
import { kompresGambar } from '@/lib/gambar'
import { cn } from '@/lib/utils'

/** Gambar yang merujuk berkas di server (jenis `laporan`) lewat atribut berkasId. */
const GambarBerkas = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      berkasId: { default: null, parseHTML: (el) => Number(el.getAttribute('data-berkas-id')) || null, renderHTML: (a) => (a.berkasId ? { 'data-berkas-id': String(a.berkasId) } : {}) },
    }
  },
})

const ekstensi = (placeholder: string) => [
  StarterKit.configure({
    heading: { levels: [3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table,
  TableRow,
  TableHeader,
  TableCell,
  GambarBerkas,
  Placeholder.configure({ placeholder }),
]

function Tombol({
  label,
  aktif,
  onClick,
  disabled,
  children,
}: {
  label: string
  aktif?: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-8', aktif && 'bg-accent text-accent-foreground')}
      aria-label={label}
      title={label}
      aria-pressed={aktif}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

const Pemisah = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />

function Toolbar({ editor, stId }: { editor: Editor; stId: number }) {
  const gambarRef = useRef<HTMLInputElement>(null)
  const [tautanBuka, setTautanBuka] = useState(false)
  const [tautan, setTautan] = useState('')
  const [mengunggah, setMengunggah] = useState(false)
  const c = editor.chain().focus()
  const dalamTabel = editor.isActive('table')
  const blok = editor.isActive('heading') ? 'heading' : 'paragraph'

  function bukaTautan() {
    setTautan((editor.getAttributes('link').href as string | undefined) ?? 'https://')
    setTautanBuka(true)
  }

  function terapkanTautan() {
    const href = tautan.trim()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else if (/^(https?:\/\/|mailto:)/i.test(href)) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      toast.error('Tautan harus diawali http://, https://, atau mailto:.')
      return
    }
    setTautanBuka(false)
  }

  async function sisipGambar(file: File) {
    setMengunggah(true)
    try {
      let berkas = file
      try {
        berkas = (await kompresGambar(file)).file
      } catch {
        berkas = file
      }
      const { berkas: dto } = await api.berkas.unggah(berkas, stId, { jenis: 'laporan', keterangan: file.name.replace(/\.[^/.]+$/, '') })
      editor
        .chain()
        .focus()
        .insertContent({ type: 'image', attrs: { src: `/api/berkas/${dto.id}/isi`, alt: dto.keterangan ?? dto.namaAsli, berkasId: dto.id } })
        .run()
    } catch (err) {
      toast.error(`Gagal menyisipkan gambar: ${pesanGalat(err)}`)
    } finally {
      setMengunggah(false)
      if (gambarRef.current) gambarRef.current.value = ''
    }
  }

  return (
    <div className="border-b bg-muted/30">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5" role="toolbar" aria-label="Format teks">
        <Tombol label="Urungkan" onClick={() => c.undo().run()} disabled={!editor.can().undo()}><UndoIcon className="size-4" /></Tombol>
        <Tombol label="Ulangi" onClick={() => c.redo().run()} disabled={!editor.can().redo()}><RedoIcon className="size-4" /></Tombol>
        <Pemisah />
        <Select
          className="h-8 w-32"
          aria-label="Gaya paragraf"
          value={blok}
          onChange={(e) => (e.target.value === 'heading' ? c.setHeading({ level: 3 }).run() : c.setParagraph().run())}
        >
          <option value="paragraph">Paragraf</option>
          <option value="heading">Subjudul</option>
        </Select>
        <Pemisah />
        <Tombol label="Tebal" aktif={editor.isActive('bold')} onClick={() => c.toggleBold().run()}><BoldIcon className="size-4" /></Tombol>
        <Tombol label="Miring" aktif={editor.isActive('italic')} onClick={() => c.toggleItalic().run()}><ItalicIcon className="size-4" /></Tombol>
        <Tombol label="Garis bawah" aktif={editor.isActive('underline')} onClick={() => c.toggleUnderline().run()}><UnderlineIcon className="size-4" /></Tombol>
        <Tombol label="Hapus format" onClick={() => c.unsetAllMarks().clearNodes().run()}><RemoveFormattingIcon className="size-4" /></Tombol>
        <Pemisah />
        <Tombol label="Rata kiri" aktif={editor.isActive({ textAlign: 'left' })} onClick={() => c.setTextAlign('left').run()}><AlignLeftIcon className="size-4" /></Tombol>
        <Tombol label="Rata tengah" aktif={editor.isActive({ textAlign: 'center' })} onClick={() => c.setTextAlign('center').run()}><AlignCenterIcon className="size-4" /></Tombol>
        <Tombol label="Rata kanan" aktif={editor.isActive({ textAlign: 'right' })} onClick={() => c.setTextAlign('right').run()}><AlignRightIcon className="size-4" /></Tombol>
        <Tombol label="Rata kiri-kanan" aktif={editor.isActive({ textAlign: 'justify' })} onClick={() => c.setTextAlign('justify').run()}><AlignJustifyIcon className="size-4" /></Tombol>
        <Pemisah />
        <Tombol label="Daftar berbutir" aktif={editor.isActive('bulletList')} onClick={() => c.toggleBulletList().run()}><ListIcon className="size-4" /></Tombol>
        <Tombol label="Daftar bernomor" aktif={editor.isActive('orderedList')} onClick={() => c.toggleOrderedList().run()}><ListOrderedIcon className="size-4" /></Tombol>
        <Pemisah />
        <Tombol label="Tautan" aktif={editor.isActive('link')} onClick={bukaTautan}><LinkIcon className="size-4" /></Tombol>
        <Tombol label="Hapus tautan" onClick={() => c.extendMarkRange('link').unsetLink().run()} disabled={!editor.isActive('link')}><Link2OffIcon className="size-4" /></Tombol>
        <Tombol label="Sisipkan tabel" onClick={() => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={dalamTabel}><TableIcon className="size-4" /></Tombol>
        <Tombol label="Sisipkan gambar" onClick={() => gambarRef.current?.click()} disabled={mengunggah}><ImageIcon className="size-4" /></Tombol>
        <input
          ref={gambarRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void sisipGambar(f)
          }}
        />
      </div>
      {tautanBuka ? (
        <form
          className="flex items-center gap-2 border-t p-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            terapkanTautan()
          }}
        >
          <Input autoFocus className="h-8 flex-1" aria-label="Alamat tautan" placeholder="https://..." value={tautan} onChange={(e) => setTautan(e.target.value)} />
          <Button type="submit" size="sm">Terapkan</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setTautanBuka(false)}>Batal</Button>
        </form>
      ) : null}
      {dalamTabel ? (
        <div className="flex flex-wrap items-center gap-1 border-t p-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">Tabel:</span>
          <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => c.addRowAfter().run()}>+ Baris</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => c.deleteRow().run()}>- Baris</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => c.addColumnAfter().run()}>+ Kolom</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => c.deleteColumn().run()}>- Kolom</Button>
          <Button type="button" variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => c.toggleHeaderRow().run()}>Baris judul</Button>
          <Button type="button" variant="outline" size="sm" className="text-destructive" onMouseDown={(e) => e.preventDefault()} onClick={() => c.deleteTable().run()}>Hapus tabel</Button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Editor teks kaya. Isi awal dibaca sekali; beri `key` berbeda bila isi dari luar berganti.
 * `bacaSaja` menampilkan dokumen tanpa toolbar (pratinjau bagian otomatis).
 */
export function EditorTeks({
  dok,
  stId,
  bacaSaja = false,
  placeholder = 'Tulis isi bagian ini.',
  onUbah,
}: {
  dok: Dok
  stId: number
  bacaSaja?: boolean
  placeholder?: string
  onUbah?: (d: Dok) => void
}) {
  const editor = useEditor({
    extensions: useMemo(() => ekstensi(placeholder), [placeholder]),
    content: dok,
    editable: !bacaSaja,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: e }) => onUbah?.(e.getJSON() as Dok),
    editorProps: { attributes: { 'aria-label': 'Isi teks', role: 'textbox', 'aria-multiline': 'true' } },
  })
  if (!editor) return null
  return (
    <div className={cn('editor-teks overflow-hidden rounded-md border bg-card', bacaSaja && 'border-dashed bg-muted/20')}>
      {bacaSaja ? null : <Toolbar editor={editor} stId={stId} />}
      <EditorContent editor={editor} />
    </div>
  )
}
