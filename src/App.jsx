import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Scanner } from '@yudiel/react-qr-scanner'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const [batches, setBatches] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showPos, setShowPos] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [activeTab, setActiveTab] = useState('home')

  const [formData, setFormData] = useState({
    product_id: '8991234567890',
    stock_quantity: '',
    expiry_date: ''
  })

  const [posCart, setPosCart] = useState([])

  // Cek sesi login saat aplikasi dimuat
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

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

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_items(*)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching transactions:', error)
    } else {
      setTransactions(data || [])
    }
  }

  useEffect(() => {
    if (session) {
      fetchBatches()
      fetchTransactions()
    }
  }, [session])

  // Handler Login & Register
  const handleAuth = async (e) => {
    e.preventDefault()
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) alert('Gagal mendaftar: ' + error.message)
      else alert('Pendaftaran berhasil! Silakan cek email atau langsung masuk jika konfirmasi dimatikan.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert('Gagal masuk: ' + error.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  const isAdmin = session?.user?.email?.toLowerCase().includes('admin')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isAdmin) {
      alert('Akses ditolak! Hanya Admin yang dapat menambah batch.')
      return
    }

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
      setFormData({ product_id: '8991234567890', stock_quantity: '', expiry_date: '' })
      setShowForm(false)
      setActiveTab('home')
      fetchBatches()
    }
  }

  const handleDeleteBatch = async (batchId) => {
    if (!isAdmin) {
      alert('Akses ditolak! Hanya Admin yang dapat menghapus batch.')
      return
    }
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

  const handlePrintBarcode = (batch) => {
    const printWindow = window.open('', '_print', 'height=600,width=400')
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Barcode - ${batch.product_name}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 20px; margin: 0; }
            .label-card { border: 1px dashed #ccc; padding: 15px; display: inline-block; border-radius: 8px; background: #fff; }
            h3 { margin: 5px 0; font-size: 16px; }
            p { margin: 4px 0; font-size: 14px; }
            .price { font-weight: bold; color: #d32f2f; font-size: 18px; }
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
              JsBarcode("#barcode", "${batch.batch_id}", { format: "CODE128", width: 1.5, height: 50, displayValue: true });
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const addToCart = (batch) => {
    if (batch.stock_quantity <= 0) {
      alert('Stok batch ini habis!')
      return
    }

    setPosCart(prevCart => {
      const existing = prevCart.find(item => item.batch_id === batch.batch_id)
      if (existing) {
        if (existing.qty >= batch.stock_quantity) {
          alert('Jumlah melebihi stok yang tersedia di batch ini!')
          return prevCart
        }
        return prevCart.map(item => 
          item.batch_id === batch.batch_id ? { ...item, qty: item.qty + 1 } : item
        )
      } else {
        return [...prevCart, { ...batch, qty: 1 }]
      }
    })
  }

  const handleCheckout = async () => {
    if (posCart.length === 0) return
    if (!window.confirm('Proses transaksi pembayaran ini? Stok akan otomatis dikurangi.')) return

    const totalAmount = posCart.reduce((sum, item) => sum + (item.current_price * item.qty), 0)

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert([{ total_amount: totalAmount }])
      .select()

    if (txError) {
      alert('Gagal memproses transaksi: ' + txError.message)
      return
    }

    const newTxId = txData[0].transaction_id

    for (const item of posCart) {
      const subtotal = item.current_price * item.qty
      
      await supabase.from('transaction_items').insert([{
        transaction_id: newTxId,
        batch_id: item.batch_id,
        product_name: item.product_name,
        qty: item.qty,
        price_at_sale: item.current_price,
        subtotal: subtotal
      }])

      const newStock = item.stock_quantity - item.qty
      await supabase
        .from('item_batches')
        .update({ stock_quantity: newStock })
        .eq('batch_id', item.batch_id)
    }

    alert('Transaksi berhasil & tercatat di laporan!')
    setPosCart([])
    setShowPos(false)
    fetchBatches()
    fetchTransactions()
  }

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

  const totalBatchesCount = batches.length
  const urgentBatchesCount = batches.filter(b => b.days_left !== undefined && b.days_left <= 3).length
  const totalStockCount = batches.reduce((sum, b) => sum + (b.stock_quantity || 0), 0)
  const cartTotalAmount = posCart.reduce((sum, item) => sum + (item.current_price * item.qty), 0)

  const totalRevenue = transactions.reduce((sum, tx) => sum + Number(tx.total_amount), 0)
  const totalItemsSold = transactions.reduce((sum, tx) => {
    const itemsCount = tx.transaction_items?.reduce((s, i) => s + i.qty, 0) || 0
    return sum + itemsCount
  }, 0)

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Memuat sesi pengguna...</div>
  }

  // TAMPILAN HALAMAN LOGIN JIKA BELUM MASUK
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-sm border border-slate-200">
          <div className="text-center mb-6">
            <span className="text-3xl">🌿</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">EcoPrice Login</h1>
            <p className="text-xs text-slate-500 mt-1">Masuk untuk mengelola sistem kasir dan inventaris toko.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input 
                type="email" 
                placeholder="contoh: admin@ecoprice.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl text-sm transition cursor-pointer shadow-sm"
            >
              {isSignUp ? 'Daftar Akun Baru' : 'Masuk Aplikasi'}
            </button>
          </form>

          <div className="text-center mt-6">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
            >
              {isSignUp ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-10 pb-24 md:pb-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🌿</span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">EcoPrice</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                {isAdmin ? '👑 ADMIN' : '🧑‍💼 KASIR'}
              </span>
            </div>
            <p className="text-sm text-slate-500">Login sebagai: <span className="font-medium text-slate-700">{session.user.email}</span></p>
          </div>
          
          <div className="hidden md:flex items-center gap-3 flex-wrap">
            <button 
              onClick={() => setActiveTab('home')}
              className={`font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm cursor-pointer ${activeTab === 'home' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            >
              📦 Produk & Stok
            </button>
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('report')}
                className={`font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm cursor-pointer ${activeTab === 'report' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
              >
                📊 Laporan Penjualan
              </button>
            )}
            <button 
              onClick={() => setShowPos(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
            >
              🛒 Kasir POS {posCart.length > 0 && `(${posCart.reduce((a,b)=>a+b.qty,0)})`}
            </button>
            <button 
              onClick={() => setShowScanner(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
            >
              📷 Scan Barcode
            </button>
            {isAdmin && (
              <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
              >
                <span>{showForm ? '✕ Tutup Form' : '+ Tambah Batch'}</span>
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm cursor-pointer"
            >
              🚪 Keluar
            </button>
          </div>
        </div>

        {/* Modal Kasir / POS */}
        {showPos && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">Kasir / Transaksi Penjualan</h3>
                <button 
                  onClick={() => setShowPos(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>

              <div className="flex-1 overflow-y-auto mb-4">
                {posCart.length === 0 ? (
                  <p className="text-slate-400 text-center py-8 text-sm">Keranjang kosong. Klik "Jual" pada produk di bawah untuk menambahkan item.</p>
                ) : (
                  <div className="space-y-3">
                    {posCart.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{item.product_name}</h4>
                          <p className="text-xs text-slate-500">Batch #{item.batch_id} • Rp {item.current_price?.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold bg-white border border-slate-200 px-3 py-1 rounded-lg">
                            Qty: {item.qty}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            Rp {(item.current_price * item.qty).toLocaleString()}
                          </span>
                          <button 
                            onClick={() => {
                              setPosCart(posCart.filter(c => c.batch_id !== item.batch_id))
                            }}
                            className="text-red-500 hover:text-red-700 text-xs cursor-pointer"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {posCart.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-700">Total Pembayaran:</span>
                    <span className="text-xl font-extrabold text-slate-900">Rp {cartTotalAmount.toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition cursor-pointer shadow-sm"
                  >
                    Selesaikan Pembayaran & Simpan Laporan
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
                      setSearchTerm(scannedText);
                      setShowScanner(false);
                      setActiveTab('home');
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

        {/* KONTEN UTAMA */}
        {activeTab === 'report' && isAdmin ? (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">📊 Laporan & Riwayat Penjualan</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pendapatan (Omset)</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">Rp {totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Transaksi Berhasil</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{transactions.length} <span className="text-sm font-normal text-slate-500">Nota</span></p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Produk Terjual</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalItemsSold} <span className="text-sm font-normal text-slate-500">Pcs</span></p>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-3">Detail Nota Transaksi</h3>
            {transactions.length === 0 ? (
              <p className="text-slate-500 text-sm bg-white p-6 rounded-2xl border border-slate-200 text-center">Belum ada riwayat transaksi penjualan yang tercatat.</p>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.transaction_id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                          Transaksi #{tx.transaction_id}
                        </span>
                        <span className="text-xs text-slate-400 ml-3">
                          {new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <span className="text-base font-extrabold text-emerald-600">
                        Rp {Number(tx.total_amount).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {tx.transaction_items?.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-slate-700">
                            • {item.product_name} <span className="text-xs text-slate-400">(Batch #{item.batch_id})</span> × {item.qty}
                          </span>
                          <span className="font-semibold text-slate-900">
                            Rp {Number(item.subtotal).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
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

            {/* Form Tambah Batch (Hanya Admin) */}
            {showForm && isAdmin && (
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
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteBatch(batch.batch_id)}
                              className="text-slate-400 hover:text-red-600 transition text-xs p-1 cursor-pointer"
                              title="Hapus Batch"
                            >
                              🗑️
                            </button>
                          )}
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

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handlePrintBarcode(batch)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          🖨️ Cetak
                        </button>
                        <button
                          onClick={() => addToCart(batch)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                        >
                          🛒 Jual
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating Bottom Navigation Bar (Khusus Mobile) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex justify-around items-center z-40 shadow-lg">
          <button 
            onClick={() => { setActiveTab('home'); setShowForm(false); setShowPos(false); setShowScanner(false); }}
            className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${activeTab === 'home' ? 'text-emerald-600 font-bold' : 'text-slate-700'}`}
          >
            <span className="text-lg">📦</span>
            <span>Produk</span>
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('report')}
              className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${activeTab === 'report' ? 'text-emerald-600 font-bold' : 'text-slate-700'}`}
            >
              <span className="text-lg">📊</span>
              <span>Laporan</span>
            </button>
          )}

          <button 
            onClick={() => setShowScanner(true)}
            className="flex flex-col items-center text-slate-700 hover:text-indigo-600 text-xs font-medium cursor-pointer py-1"
          >
            <span className="text-lg">📷</span>
            <span>Scan</span>
          </button>

          <button 
            onClick={() => setShowPos(true)}
            className="flex flex-col items-center text-slate-700 hover:text-amber-600 text-xs font-medium cursor-pointer py-1 relative"
          >
            <span className="text-lg">🛒</span>
            <span>Kasir</span>
            {posCart.length > 0 && (
              <span className="absolute top-0 right-2 bg-amber-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {posCart.reduce((a,b)=>a+b.qty,0)}
              </span>
            )}
          </button>

          {isAdmin && (
            <button 
              onClick={() => { setActiveTab('home'); setShowForm(!showForm); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex flex-col items-center text-slate-700 hover:text-emerald-600 text-xs font-medium cursor-pointer py-1"
            >
              <span className="text-lg">➕</span>
              <span>Tambah</span>
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="flex flex-col items-center text-red-600 text-xs font-medium cursor-pointer py-1"
          >
            <span className="text-lg">🚪</span>
            <span>Keluar</span>
          </button>
        </div>

      </div>
    </div>
  )
}