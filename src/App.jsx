import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Scanner } from '@yudiel/react-qr-scanner'

export default function App() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false) // State untuk modal scanner kamera
  const [scanResult, setScanResult] = useState(null)     // Hasil scan barcode

  // State untuk pencarian dan filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'urgent', 'safe'

  // State form input untuk batch baru
  const [formData, setFormData] = useState({
    product_id: '8991234567890',
    stock_quantity: '',
    expiry_date: ''
  })

  // Ambil data dari view Supabase: v_ecoprice_products
  const fetchBatches = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('v_ecoprice_products')
      .select('*')
      .order('expiry_date', { ascending: true })

    if (error) {
      console.error('Error fetching data:', error)
    } else {
      setBatches(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  // Fungsi simpan batch baru ke tabel item_batches
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const { error } = await supabase
      .from('item_batches')
      .insert([
        {
          product_id: formData.product_id,
          expiry_date: formData.expiry_date,
          stock_quantity: parseInt(formData.stock_quantity),
          status: 'Active'
        }
      ])

    if (error) {
      alert('Gagal menambah batch: ' + error.message)
    } else {
      alert('Berhasil menambah batch baru!')
      setFormData({
        product_id: '8991234567890',
        stock_quantity: '',
        expiry_date: ''
      })
      setShowForm(false)
      fetchBatches()
    }
  }

  // Fungsi hapus batch berdasarkan batch_id
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm(`Yakin ingin menghapus Batch #${batchId}?`)) return

    const { error } = await supabase
      .from('item_batches')
      .delete()
      .eq('batch_id', batchId)

    if (error) {
      alert('Gagal menghapus batch: ' + error.message)
    } else {
      alert('Batch berhasil dihapus!')
      fetchBatches()
    }
  }

  // Fungsi Cetak Barcode per Batch
  const handlePrintBarcode = (batch) => {
    const printWindow = window.open('', '_print', 'height=600,width=400')
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Barcode - ${batch.product_name}</title>
          <style>
            body {
              font-family: sans-serif;
              text-align: center;
              padding: 20px;
              margin: 0;
            }
            .label-card {
              border: 1px dashed #ccc;
              padding: 15px;
              display: inline-block;
              border-radius: 8px;
              background: #fff;
            }
            h3 { margin: 5px 0; font-size: 16px; }
            p { margin: 4px 0; font-size: 14px; }
            .price { font-weight: bold; color: #d32f2f; font-size: 18px; }
            @media print {
              body { padding: 0; }
              .label-card { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <h3>${batch.product_name}</h3>
            <p>Batch ID: ${batch.batch_id}</p>
            <p class="price">Rp ${(batch.current_price || 0).toLocaleString('id-ID')}</p>
            <p style="font-size: 12px; color: #666;">Exp: ${batch.expiry_date}</p>
            <svg id="barcode"></svg>
          </div>

          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script>
            window.onload = function() {
              JsBarcode("#barcode", "${batch.batch_id}", {
                format: "CODE128",
                width: 1.5,
                height: 50,
                displayValue: true
              });
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Filter dan Search Logic
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = batch.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(batch.batch_id).includes(searchTerm)
    
    if (filterType === 'urgent') {
      return matchesSearch && (batch.days_left !== undefined && batch.days_left <= 3)
    } else if (filterType === 'safe') {
      return matchesSearch && (batch.days_left !== undefined && batch.days_left > 3)
    }
    
    return matchesSearch
  })

  // Perhitungan Statistik Real-time untuk Widget Dashboard
  const totalBatchesCount = batches.length
  const urgentBatchesCount = batches.filter(b => b.days_left !== undefined && b.days_left <= 3).length
  const totalStockCount = batches.reduce((sum, b) => sum + (b.stock_quantity || 0), 0)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🌿</span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">EcoPrice</h1>
            </div>
            <p className="text-sm text-slate-500">Sistem otomatis menampilkan harga tiap batch secara real-time.</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tombol Buka Scanner Kamera */}
            <button 
              onClick={() => setShowScanner(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
            >
              📷 Scan Barcode
            </button>

            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
            >
              <span>{showForm ? '✕ Tutup Form' : '+ Tambah Batch Baru'}</span>
            </button>

            <button 
              onClick={fetchBatches}
              className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
            >
              🔄 Sync & Refresh
            </button>
          </div>
        </div>

        {/* Modal Scanner Kamera */}
        {showScanner && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Scan Barcode Produk</h3>
                <button 
                  onClick={() => setShowScanner(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-black aspect-square relative mb-4">
                <Scanner 
                  onScan={(result) => {
                    if (result && result.length > 0) {
                      const scannedText = result[0].rawValue;
                      setSearchTerm(scannedText); // Otomatis masukkan hasil scan ke kolom pencarian
                      setShowScanner(false);      // Tutup scanner otomatis
                    }
                  }}
                  onError={(error) => console.log(error)}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                Arahkan kamera ke barcode/QR code batch produk. Hasil scan akan otomatis memfilter produk di layar.
              </p>
            </div>
          </div>
        )}

        {/* Ringkasan Statistik Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Batch Aktif</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalBatchesCount} <span className="text-sm font-normal text-slate-500">Batch</span></p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">🔥 Mendesak (&le; 3 Hari)</p>
            <p className={`text-2xl font-bold mt-1 ${urgentBatchesCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {urgentBatchesCount} <span className="text-sm font-normal text-slate-500">Batch</span>
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Stok Tersedia</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalStockCount} <span className="text-sm font-normal text-slate-500">Pcs</span></p>
          </div>
        </div>

        {/* Form Tambah Batch */}
        {showForm && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 transition-all">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Input Batch Produk Baru</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Product ID</label>
                <input 
                  type="text" 
                  value={formData.product_id}
                  onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah Stok (Pcs)</label>
                <input 
                  type="number" 
                  placeholder="Contoh: 10"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Kadaluarsa</label>
                <input 
                  type="date" 
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex items-end lg:col-span-3">
                <button 
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-sm transition cursor-pointer"
                >
                  Simpan Batch Baru
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Section Search & Filter Controls */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 gap-4">
          <div className="w-full md:w-72">
            <input 
              type="text"
              placeholder="🔍 Cari nama produk / ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${filterType === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              Semua Batch
            </button>
            <button 
              onClick={() => setFilterType('urgent')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${filterType === 'urgent' ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              🔥 Mendesak (&le; 3 Hari)
            </button>
            <button 
              onClick={() => setFilterType('safe')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${filterType === 'safe' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              🛡️ Aman (&gt; 3 Hari)
            </button>
          </div>
        </div>

        {/* Daftar Produk */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">Daftar Produk Susu</h2>

        {loading ? (
          <p className="text-slate-500 text-sm">Memuat data produk...</p>
        ) : filteredBatches.length === 0 ? (
          <p className="text-slate-500 text-sm">Tidak ada produk yang sesuai dengan pencarian atau filter.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBatches.map((batch, index) => (
              <div key={index} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                      Batch #{batch.batch_id || index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${batch.days_left !== undefined && batch.days_left <= 3 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {batch.days_left !== undefined ? `${batch.days_left} Hari Lagi` : 'Segera Exp'}
                      </span>
                      {/* Tombol Hapus */}
                      <button 
                        onClick={() => handleDeleteBatch(batch.batch_id)}
                        className="text-slate-400 hover:text-red-600 transition text-xs p-1 cursor-pointer"
                        title="Hapus Batch"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      Stok: {batch.stock_quantity} pcs
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-2">{batch.product_name}</h3>
                    <p className="text-xs text-slate-500">Exp: {batch.expiry_date}</p>
                  </div>
                </div>

                <div>
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between mb-3">
                    <div>
                      <span className="text-xs text-slate-400 line-through">Rp {batch.normal_price?.toLocaleString()}</span>
                      <p className="text-xl font-extrabold text-slate-900">Rp {(batch.current_price || 0).toLocaleString()}</p>
                    </div>
                    <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-md">
                      {batch.current_price < batch.normal_price 
                        ? `DISKON ${Math.round((1 - batch.current_price / batch.normal_price) * 100)}%` 
                        : 'NORMAL'}
                    </span>
                  </div>

                  {/* Tombol Cetak Barcode */}
                  <button
                    onClick={() => handlePrintBarcode(batch)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    🖨️ Cetak Barcode Batch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}