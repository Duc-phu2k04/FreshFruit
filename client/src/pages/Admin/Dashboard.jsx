import React, { Fragment, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Doughnut, Line, Radar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, RadialLinearScale, LineElement, PointElement, CategoryScale, LinearScale } from 'chart.js';

import MetaData from './MetaData';
import Loader from '../../components/common/Loader';
import Sidebar from './SideBar';
import ChartIncome from './Chatincome';

ChartJS.register(ArcElement, Tooltip, Legend, RadialLinearScale, LineElement, PointElement, CategoryScale, LinearScale);

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const resProducts = await axios.get('/api/v1/admin/products'); // bạn cần route trả về product.populate('category')
                const resOrders = await axios.get('/api/v1/admin/orders');
                const resUsers = await axios.get('/api/v1/admin/users');

                setProducts(resProducts.data.products || []);
                setOrders(resOrders.data.orders || []);
                setUsers(resUsers.data.users || []);
                setLoading(false);
            } catch (error) {
                console.error("Lỗi khi lấy dữ liệu dashboard:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // === Tính toán ===
    let outOfStock = products.filter(p => p.stock === 0).length;
    let da_dat_hang = 0, dang_van_chuyen = 0, da_giao_hang = 0;

    orders.forEach(order => {
        if (order.orderStatus === "Đã đặt hàng") da_dat_hang++;
        if (order.orderStatus === "Đang vận chuyển") dang_van_chuyen++;
        if (order.orderStatus === "Đã giao hàng") da_giao_hang++;
    });

    const totalAmountall = orders.reduce((acc, cur) => acc + (cur.totalPrice || 0), 0);

    // === Biểu đồ ===
    const lineState = {
        labels: ["Số tiền ban đầu", "Tổng doanh thu hiện tại"],
        datasets: [{
            label: "TỔNG DOANH THU",
            backgroundColor: ["blue"],
            hoverBackgroundColor: ["rgb(197, 72, 49)"],
            data: [0, totalAmountall],
        }],
    };

    const doughnutState = {
        labels: ["Hết hàng", "Còn hàng"],
        datasets: [{
            backgroundColor: ["#00A6B4", "#6800B4"],
            hoverBackgroundColor: ["#FF1493", "#FFD700"],
            data: [outOfStock, products.length - outOfStock],
        }],
    };

    const doughnutStateOrder = {
        labels: ["Đã đặt hàng", "Đang vận chuyển", "Đã giao hàng"],
        datasets: [{
            backgroundColor: ["#00A6B4", "#6800B4", "#FF7F50"],
            hoverBackgroundColor: ["#FF1493", "#00FA9A", "#FFD700"],
            data: [da_dat_hang, dang_van_chuyen, da_giao_hang],
        }],
    };

    // === Radar theo danh mục ===
    const countByCategory = (catName) => products.filter(p => p.category?.name === catName).length;

    const radarData = {
        labels: [

        ],
        datasets: [{
            label: 'Danh mục sản phẩm',
            data: [

            ],
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgb(54, 162, 235)',
            pointBackgroundColor: 'rgb(54, 162, 235)',
        }]
    };

    return (
        <Fragment>
            <div className="grid-bg ba-grid anim">
                <div className="inner">
                    <div className="row">
                        <div className="col-12 col-md-2"><Sidebar /></div>
                        <div className="col-12 col-md-10">
                            <h1 className="my-4">Tổng quan</h1>

                            {loading ? <Loader /> : (
                                <Fragment>
                                    <MetaData title="Admin Dashboard" />

                                    <div className="row pr-4">
                                        <DashboardCard title="Tổng doanh thu" value={`${totalAmountall.toLocaleString()} VNĐ`} link="/admin/orders" color="primary" />
                                        <DashboardCard title="Tổng sản phẩm" value={products.length} link="/admin/products" color="success" />
                                        <DashboardCard title="Tổng hóa đơn" value={orders.length} link="/admin/orders" color="danger" />
                                        <DashboardCard title="Tổng người dùng" value={users.length} link="/admin/users" color="info" />
                                        <DashboardChart title="Tình trạng hàng hóa" chart={<Doughnut data={doughnutState} />} />
                                        <DashboardChart title="Tình trạng đơn hàng" chart={<Doughnut data={doughnutStateOrder} />} />
                                        <div className="col-xl-6 col-sm-12 mb-3">
                                            <div className="card text-white bg-light o-hidden h-100">
                                                <div className="card-body">
                                                    <h6 className='text-dark'>Tổng doanh thu</h6>
                                                    <div className="lineChart">
                                                        <Line data={lineState} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className='row'>
                                        <div className='col-md-6'>
                                            <ChartIncome />
                                        </div>
                                        <div className='radar col-md-5 card text-white bg-light'>
                                            <Radar data={radarData} />
                                        </div>
                                    </div>
                                </Fragment>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

const DashboardCard = ({ title, value, link, color }) => (
    <div className="col-xl-3 col-sm-6 mb-3">
        <div className={`card text-white bg-${color} o-hidden h-100`}>
            <div className="card-body">
                <div className="text-center card-font-size">{title}<br /><b>{value}</b></div>
            </div>
            <Link className="card-footer text-white clearfix small z-1" to={link}>
                <span className="float-left">Xem chi tiết</span>
                <span className="float-right"><i className="fa fa-angle-right"></i></span>
            </Link>
        </div>
    </div>
);

const DashboardChart = ({ title, chart }) => (
    <div className="col-xl-3 col-sm-6 mb-3">
        <div className="card text-white bg-light o-hidden h-100">
            <div className="card-body">
                <h6 className='text-dark'>{title}</h6>
                <div>{chart}</div>
            </div>
        </div>
    </div>
);

export default Dashboard;
