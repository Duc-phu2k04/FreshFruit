import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from "./layouts/Main-layout"
import Homepage from "./pages/Homepage/Homepage"
import Checkout from "./pages/Checkout/Checkout"


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="/" element={<Homepage />} />
          <Route path="/checkout" element={<Checkout />} />
        </Route>
      </Routes>
    </BrowserRouter >
  )
}

export default App
