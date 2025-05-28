import React from 'react';

const PhoneSubscribe = () => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const phone = e.target.elements.phone.value;
    console.log("Số điện thoại:", phone);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-center w-full md:w-fit gap-3 md:gap-0">
      <input
        type="text"
        name="phone"
        placeholder="Số điện thoại"
        className="rounded-full px-6 py-3 w-full md:w-[436px] outline-none bg-white mr-0 md:mr-3"
        required
      />
      <button
        type="submit"
        className="bg-[#FFB800] text-white font-normal px-6 py-3 rounded-full hover:bg-[#00613C] transition cursor-pointer w-full md:w-auto"
      >
        NHẬN ƯU ĐÃI
      </button>
    </form>
  );
};

export default PhoneSubscribe;
