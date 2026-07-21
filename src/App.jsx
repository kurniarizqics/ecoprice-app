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
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showPos, setShowPos] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeTab, setActiveTab] = useState('home')
  
  // State untuk Mode Gelap
  const [darkMode, setDarkMode] = useState(false)

  const [formData, setFormData] = useState({
    product_id: '8991234567890',
    product_name: '',
    category_id: '',
    stock_quantity: '',
    expiry_date: ''
  })

  const [posCart, setPosCart] = useState([])
  const [posSearch, setPosSearch] = useState('')

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

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
    } else {
      setCategories(data || [])
      if (data && data.length > 0 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: data[0].id }))
      }
    }
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
      fetchCategories()
      fetchTransactions()
    }
  }, [session])

  const handleAuth = async (e) => {
    e.preventDefault()
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) alert('Gagal mendaftar: ' + error.message)
      else alert('Pendaftaran berhasil! Silakan masuk.')
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
      setFormData({
        product_id: '8991234567890',
        product_name: '',
        category_id: categories[0]?.id || '',
        stock_quantity: '',
        expiry_date: ''
      })
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

  const handlePrintReceipt = (transaction, items) => {
    const printWindow = window.open('', '_receipt', 'height=650,width=400')
    const formattedDate = new Date(transaction.created_at || Date.now()).toLocaleString('id-ID')
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Belanja - EcoPrice</title>
          <style>
            body { font-family: 'Courier New', monospace; text-align: center; padding: 15px; margin: 0; font-size: 12px; color: #111; }
            .header { margin-bottom: 15px; border-bottom: 1px dashed #333; padding-bottom: 10px; }
            h2 { margin: 0; font-size: 16px; font-weight: bold; }
            p { margin: 3px 0; }
            .items { text-align: left; width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; border-bottom: 1px dashed #333; padding-bottom: 10px; }
            .items th { border-bottom: 1px solid #333; font-size: 11px; padding-bottom: 4px; }
            .items td { padding: 4px 0; font-size: 11px; vertical-align: top; }
            .total-section { text-align: right; margin-top: 10px; font-size: 13px; font-weight: bold; }
            .footer { margin-top: 20px; font-size: 10px; color: #555; border-top: 1px dashed #333; pt: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>🌿 ECOPRICE STORE</h2>
            <p>Sistem Minimarket Anti-Waste</p>
            <p>Nota: #${transaction.transaction_id}</p>
            <p>${formattedDate}</p>
          </div>
          <table class="items">
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i => `
                <tr>
                  <td>${i.product_name}<br/><span style="font-size:9px; color:#555;">@Rp ${Number(i.price_at_sale).toLocaleString()}</span></td>
                  <td style="text-align:center;">${i.qty}</td>
                  <td style="text-align:right;">Rp ${Number(i.subtotal).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <p>TOTAL: Rp ${Number(transaction.total_amount).toLocaleString()}</p>
          </div>
          <div class="footer">
            <p>Terima Kasih Telah Berbelanja!</p>
            <p>Barang diskon expired aman dikonsumsi.</p>
          </div>
          <script>
            window.onload = function() {
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
    const transactionRecord = txData[0]
    const insertedItems = []

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

      insertedItems.push({
        product_name: item.product_name,
        qty: item.qty,
        price_at_sale: item.current_price,
        subtotal: subtotal
      })

      const newStock = item.stock_quantity - item.qty
      await supabase
        .from('item_batches')
        .update({ stock_quantity: newStock })
        .eq('batch_id', item.batch_id)
    }

    alert('Transaksi berhasil & tercatat di laporan!')
    handlePrintReceipt(transactionRecord, insertedItems)

    setPosCart([])
    setPosSearch('')
    setShowPos(false)
    fetchBatches()
    fetchTransactions()
  }

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = batch.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(batch.batch_id).includes(searchTerm)
    const matchesCategory = selectedCategory === 'all' || batch.category_id === selectedCategory

    if (filterType === 'urgent') {
      return matchesSearch && matchesCategory && (batch.days_left !== undefined && batch.days_left <= 3)
    } else if (filterType === 'safe') {
      return matchesSearch && matchesCategory && (batch.days_left !== undefined && batch.days_left > 3)
    }
    return matchesSearch && matchesCategory
  })

  const posAvailableBatches = batches.filter(batch => {
    const query = posSearch.toLowerCase()
    return batch.product_name?.toLowerCase().includes(query) || String(batch.batch_id).includes(query)
  })

  const totalBatchesCount = batches.length
  const urgentBatches = batches.filter(b => b.days_left !== undefined && b.days_left <= 3)
  const urgentBatchesCount = urgentBatches.length
  const totalStockCount = batches.reduce((sum, b) => sum + (b.stock_quantity || 0), 0)
  const cartTotalAmount = posCart.reduce((sum, item) => sum + (item.current_price * item.qty), 0)

  const totalRevenue = transactions.reduce((sum, tx) => sum + Number(tx.total_amount), 0)
  const totalItemsSold = transactions.reduce((sum, tx) => {
    const itemsCount = tx.transaction_items?.reduce((s, i) => s + i.qty, 0) || 0
    return sum + itemsCount
  }, 0)

  // Metrik Eco-Impact (Dampak Lingkungan)
  const totalItemsSaved = totalItemsSold + batches.reduce((sum, b) => sum + (b.stock_quantity || 0), 0)
  const estimatedKgSaved = (totalItemsSaved * 0.45).toFixed(1)

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Memuat sesi pengguna...</div>
  }

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
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} p-6 md:p-10 pb-24 md:pb-10`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🌿</span>
              <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>EcoPrice</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${isAdmin ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                {isAdmin ? '👑 ADMIN' : '🧑‍💼 KASIR'}
              </span>
            </div>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Login sebagai: <span className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{session.user.email}</span></p>
          </div>
          
          <div className="hidden md:flex items-center gap-3 flex-wrap">
            <button 
              onClick={() => setActiveTab('home')}
              className={`font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm cursor-pointer ${activeTab === 'home' ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white') : (darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100')}`}
            >
              📦 Produk & Stok
            </button>
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('report')}
                className={`font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm cursor-pointer ${activeTab === 'report' ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white') : (darkMode ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100')}`}
              >
                📊 Laporan & Eco-Impact
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
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border text-sm transition cursor-pointer ${darkMode ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
              title="Ganti Mode Tampilan"
            >
              {darkMode ? '☀️ Terang' : '🌙 Gelap'}
            </button>

            <button 
              onClick={handleLogout}
              className={`font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm cursor-pointer ${darkMode ? 'bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/40' : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'}`}
            >
              🚪 Keluar
            </button>
          </div>
        </div>

        {/* Modal Kasir / POS */}
        {showPos && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`rounded-2xl max-w-3xl w-full p-6 shadow-xl max-h-[92vh] flex flex-col ${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-white text-slate-800'}`}>
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold">Kasir / Transaksi Penjualan POS</h3>
                  <p className="text-xs text-slate-400">Cari produk instan di bawah atau masukkan ke keranjang belanja.</p>
                </div>
                <button 
                  onClick={() => setShowPos(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold px-2 py-1 cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>

              {/* Pencarian Produk Cepat di Kasir */}
              <div className="mb-4">
                <input 
                  type="text"
                  placeholder="🔍 Ketik nama produk / No. Batch untuk ditambahkan..."
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200'}`}
                />
                {posSearch.trim() !== '' && (
                  <div className={`mt-2 max-h-40 overflow-y-auto border rounded-xl shadow-sm divide-y ${darkMode ? 'bg-slate-800 border-slate-700 divide-slate-700' : 'bg-white border-slate-200 divide-slate-100'}`}>
                    {posAvailableBatches.length === 0 ? (
                      <p className="p-3 text-xs text-slate-400 text-center">Produk tidak ditemukan.</p>
                    ) : (
                      posAvailableBatches.map((b, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-2.5 transition ${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                          <div>
                            <span className="font-bold text-xs">{b.product_name}</span>
                            <span className="text-[10px] text-slate-400 ml-2">Batch #{b.batch_id} • Stok: {b.stock_quantity}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-extrabold text-amber-500">Rp {(b.current_price || 0).toLocaleString()}</span>
                            <button 
                              onClick={() => addToCart(b)}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer"
                            >
                              + Tambah
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Daftar Keranjang Belanja */}
              <div className={`flex-1 overflow-y-auto mb-4 border rounded-xl p-3 ${darkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Item dalam Keranjang</h4>
                {posCart.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 text-sm">Keranjang kosong. Cari produk di atas untuk mulai transaksi.</p>
                ) : (
                  <div className="space-y-2">
                    {posCart.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border shadow-xs ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div>
                          <h4 className="font-bold text-sm">{item.product_name}</h4>
                          <p className="text-xs text-slate-400">Batch #{item.batch_id} • @Rp {item.current_price?.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center border rounded-lg overflow-hidden ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                            <button 
                              onClick={() => {
                                setPosCart(posCart.map(c => c.batch_id === item.batch_id ? { ...c, qty: Math.max(1, c.qty - 1) } : c))
                              }}
                              className="px-2.5 py-1 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                            >-</button>
                            <span className="px-3 text-xs font-bold">{item.qty}</span>
                            <button 
                              onClick={() => {
                                if (item.qty >= item.stock_quantity) {
                                  alert('Stok batch tidak mencukupi!')
                                  return
                                }
                                setPosCart(posCart.map(c => c.batch_id === item.batch_id ? { ...c, qty: c.qty + 1 } : c))
                              }}
                              className="px-2.5 py-1 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                            >+</button>
                          </div>
                          <span className="font-bold text-sm w-24 text-right">
                            Rp {(item.current_price * item.qty).toLocaleString()}
                          </span>
                          <button 
                            onClick={() => {
                              setPosCart(posCart.filter(c => c.batch_id !== item.batch_id))
                            }}
                            className="text-red-400 hover:text-red-300 text-xs cursor-pointer p-1"
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
                <div className={`border-t pt-4 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold">Total Pembayaran:</span>
                    <span className="text-2xl font-extrabold text-emerald-500">Rp {cartTotalAmount.toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    <span>🖨️ Selesaikan Pembayaran & Cetak Struk</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Scanner */}
        {showScanner && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${darkMode ? 'bg-slate-900 border border-slate-800 text-slate-100' : 'bg-white text-slate-800'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Scan Barcode Produk</h3>
                <button 
                  onClick={() => setShowScanner(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold px-2 py-1 cursor-pointer"
                >
                  ✕ Tutup
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-700 bg-black aspect-square relative mb-4">
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
              <p className="text-xs text-slate-400 text-center">
                Arahkan kamera ke barcode/QR code batch produk. Hasil scan akan otomatis memfilter produk di layar.
              </p>
            </div>
          </div>
        )}

        {/* KONTEN UTAMA */}
        {activeTab === 'report' && isAdmin ? (
          <div>
            <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>📊 Laporan Penjualan & Metrik Eco-Impact</h2>

            {/* Kartu Metrik Dampak Lingkungan (Eco-Impact Card) */}
            <div className={`p-6 rounded-2xl border mb-6 shadow-sm relative overflow-hidden ${darkMode ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-900/50' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'}`}>
              <div className="absolute right-4 top-4 text-4xl opacity-20">🌱</div>
              <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>
                🌍 Dampak Lingkungan Toko (Eco-Impact Metric)
              </h3>
              <p className={`text-xs mb-4 ${darkMode ? 'text-slate-300' : 'text-emerald-900'}`}>
                Berkat sistem diskon otomatis produk mendekati masa kedaluwarsa, EcoPrice berhasil menyelamatkan produk dari pembuangan sia-sia (*food waste*).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900/80 border-emerald-900/40' : 'bg-white border-emerald-100'}`}>
                  <p className="text-xs text-slate-400">Total Produk Diselamatkan</p>
                  <p className="text-2xl font-extrabold text-emerald-500 mt-1">{totalItemsSaved} <span className="text-sm font-normal text-slate-400">Pcs / Unit</span></p>
                </div>
                <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900/80 border-emerald-900/40' : 'bg-white border-emerald-100'}`}>
                  <p className="text-xs text-slate-400">Estimasi Limbah Makanan Dicegah</p>
                  <p className="text-2xl font-extrabold text-teal-400 mt-1">~{estimatedKgSaved} <span className="text-sm font-normal text-slate-400">Kilogram (kg)</span></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className={`border rounded-2xl p-4 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pendapatan (Omset)</p>
                <p className="text-2xl font-bold text-emerald-500 mt-1">Rp {totalRevenue.toLocaleString()}</p>
              </div>
              <div className={`border rounded-2xl p-4 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Transaksi Berhasil</p>
                <p className="text-2xl font-bold mt-1">{transactions.length} <span className="text-sm font-normal text-slate-400">Nota</span></p>
              </div>
              <div className={`border rounded-2xl p-4 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Produk Terjual</p>
                <p className="text-2xl font-bold mt-1">{totalItemsSold} <span className="text-sm font-normal text-slate-400">Pcs</span></p>
              </div>
            </div>

            <h3 className={`text-lg font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Detail Nota Transaksi</h3>
            {transactions.length === 0 ? (
              <p className={`text-sm p-6 rounded-2xl border text-center ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>Belum ada riwayat transaksi penjualan yang tercatat.</p>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.transaction_id} className={`p-5 rounded-2xl shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className={`flex justify-between items-center mb-3 pb-2 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                          Transaksi #{tx.transaction_id}
                        </span>
                        <span className="text-xs text-slate-400 ml-3">
                          {new Date(tx.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePrintReceipt(tx, tx.transaction_items || [])}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                        >
                          🖨️ Cetak Ulang Struk
                        </button>
                        <span className="text-base font-extrabold text-emerald-500">
                          Rp {Number(tx.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {tx.transaction_items?.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-700'}>
                            • {item.product_name} <span className="text-xs text-slate-500">(Batch #{item.batch_id})</span> × {item.qty}
                          </span>
                          <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
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
            {/* Banner Real-Time Peringatan Dini Produk Expired (Alert Banner) */}
            {urgentBatchesCount > 0 && (
              <div className={`mb-6 p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${darkMode ? 'bg-red-950/30 border-red-900/60 text-red-200' : 'bg-red-50 border-red-200 text-red-900'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">🔥</span>
                  <div>
                    <h3 className="font-bold text-sm">Peringatan Real-Time: {urgentBatchesCount} Batch Produk Mendekati Kedaluwarsa!</h3>
                    <p className={`text-xs mt-0.5 ${darkMode ? 'text-red-300/80' : 'text-red-700'}`}>
                      Produk-produk berikut berada dalam masa kritis (&le; 3 hari). Segera prioritaskan promosi atau diskon maksimal untuk mencegah terbuang.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {urgentBatches.slice(0, 4).map((b, idx) => (
                        <span key={idx} className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${darkMode ? 'bg-red-900/50 border-red-800 text-red-200' : 'bg-white border-red-200 text-red-800'}`}>
                          {b.product_name} ({b.days_left} hari lagi)
                        </span>
                      ))}
                      {urgentBatches.length > 4 && (
                        <span className="text-[11px] font-bold self-center px-1">+{urgentBatches.length - 4} lainnya</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setFilterType('urgent')}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${darkMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                  Lihat Produk Mendesak 🔍
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className={`border rounded-2xl p-4 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Batch Aktif</p>
                <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{totalBatchesCount} <span className="text-sm font-normal text-slate-400">Batch</span></p>
              </div>
              
              <div className={`border rounded-2xl p-4 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">🔥 Mendesak (&le; 3 Hari)</p>
                <p className={`text-2xl font-bold mt-1 ${urgentBatchesCount > 0 ? 'text-red-500' : (darkMode ? 'text-white' : 'text-slate-900')}`}>
                  {urgentBatchesCount} <span className="text-sm font-normal text-slate-400">Batch</span>
                </p>
              </div>

              <div className={`border rounded-2xl p-4 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Stok Tersedia</p>
                <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{totalStockCount} <span className="text-sm font-normal text-slate-400">Pcs</span></p>
              </div>
            </div>

            {/* Form Tambah Batch */}
            {showForm && isAdmin && (
              <div className={`p-6 rounded-2xl shadow-sm border mb-8 transition-all ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-slate-800'}`}>Input Batch Produk Baru</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Product ID</label>
                    <input 
                      type="text" 
                      value={formData.product_id}
                      onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-200'}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Jumlah Stok (Pcs)</label>
                    <input 
                      type="number" 
                      placeholder="Contoh: 10"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-200'}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tanggal Kadaluarsa</label>
                    <input 
                      type="date" 
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'border-slate-200'}`}
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

            {/* Filter Controls */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 gap-4">
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <input 
                  type="text"
                  placeholder="🔍 Cari nama produk / ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`border rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-64 ${darkMode ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`}
                />

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`border rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                >
                  <option value="all">📁 Semua Kategori</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                <button 
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${filterType === 'all' ? (darkMode ? 'bg-slate-100 text-slate-900 shadow-sm' : 'bg-slate-900 text-white shadow-sm') : (darkMode ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100')}`}
                >
                  Semua Status
                </button>
                <button 
                  onClick={() => setFilterType('urgent')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${filterType === 'urgent' ? 'bg-red-600 text-white shadow-sm' : (darkMode ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100')}`}
                >
                  🔥 Mendesak (&le; 3 Hari)
                </button>
                <button 
                  onClick={() => setFilterType('safe')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${filterType === 'safe' ? 'bg-emerald-600 text-white shadow-sm' : (darkMode ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100')}`}
                >
                  🛡️ Aman (&gt; 3 Hari)
                </button>
              </div>
            </div>

            <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Daftar Produk Toko</h2>

            {loading ? (
              <p className="text-slate-500 text-sm">Memuat data produk...</p>
            ) : filteredBatches.length === 0 ? (
              <p className="text-slate-500 text-sm">Tidak ada produk yang sesuai dengan pencarian atau filter.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBatches.map((batch, index) => (
                  <div key={index} className={`p-5 rounded-2xl shadow-sm border flex flex-col justify-between ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          Batch #{batch.batch_id || index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${batch.days_left !== undefined && batch.days_left <= 3 ? 'bg-red-950/60 text-red-400 border border-red-900/40' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40'}`}>
                            {batch.days_left !== undefined ? `${batch.days_left} Hari Lagi` : 'Segera Exp'}
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteBatch(batch.batch_id)}
                              className="text-slate-500 hover:text-red-400 transition text-xs p-1 cursor-pointer"
                              title="Hapus Batch"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-400'}`}>
                            Stok: {batch.stock_quantity} pcs
                          </span>
                        </div>
                        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{batch.product_name}</h3>
                        <p className="text-xs text-slate-400 mt-1">Exp: {batch.expiry_date}</p>
                      </div>
                    </div>

                    <div>
                      <div className={`border-t pt-4 flex items-center justify-between mb-3 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div>
                          <span className="text-xs text-slate-500 line-through">Rp {batch.normal_price?.toLocaleString()}</span>
                          <p className={`text-xl font-extrabold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Rp {(batch.current_price || 0).toLocaleString()}</p>
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
                          className={`font-medium py-2 px-2 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
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
        <div className={`md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md border-t px-4 py-2 flex justify-around items-center z-40 shadow-lg ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
          <button 
            onClick={() => { setActiveTab('home'); setShowForm(false); setShowPos(false); setShowScanner(false); }}
            className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${activeTab === 'home' ? 'text-emerald-500 font-bold' : (darkMode ? 'text-slate-400' : 'text-slate-700')}`}
          >
            <span className="text-lg">📦</span>
            <span>Produk</span>
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('report')}
              className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${activeTab === 'report' ? 'text-emerald-500 font-bold' : (darkMode ? 'text-slate-400' : 'text-slate-700')}`}
            >
              <span className="text-lg">📊</span>
              <span>Laporan</span>
            </button>
          )}

          <button 
            onClick={() => setShowScanner(true)}
            className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${darkMode ? 'text-slate-400 hover:text-indigo-400' : 'text-slate-700 hover:text-indigo-600'}`}
          >
            <span className="text-lg">📷</span>
            <span>Scan</span>
          </button>

          <button 
            onClick={() => setShowPos(true)}
            className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 relative ${darkMode ? 'text-slate-400 hover:text-amber-400' : 'text-slate-700 hover:text-amber-600'}`}
          >
            <span className="text-lg">🛒</span>
            <span>Kasir</span>
            {posCart.length > 0 && (
              <span className="absolute top-0 right-2 bg-amber-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {posCart.reduce((a,b)=>a+b.qty,0)}
              </span>
            )}
          </button>

          {/* Toggle Mode Gelap Mobile */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${darkMode ? 'text-amber-400' : 'text-slate-700'}`}
          >
            <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
            <span>{darkMode ? 'Terang' : 'Gelap'}</span>
          </button>

          {isAdmin && (
            <button 
              onClick={() => { setActiveTab('home'); setShowForm(!showForm); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={`flex flex-col items-center text-xs font-medium cursor-pointer py-1 ${darkMode ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-700 hover:text-emerald-600'}`}
            >
              <span className="text-lg">➕</span>
              <span>Tambah</span>
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="flex flex-col items-center text-red-500 text-xs font-medium cursor-pointer py-1"
          >
            <span className="text-lg">🚪</span>
            <span>Keluar</span>
          </button>
        </div>

      </div>
    </div>
  )
}