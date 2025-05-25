import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from "./layouts/Main-layout"
import Homepage from "./pages/Homepage/Homepage"


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="/" element={<Homepage />} />
        </Route>
      </Routes>
    </BrowserRouter >
  )
}

export default App
