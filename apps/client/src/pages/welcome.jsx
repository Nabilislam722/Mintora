import React from 'react'
import "../components/welcome.css"

export default function Welcome() {
  return (
    <div className='flex items-center justify-center bg-black wc-bg'>

      <section className='flex flex-col justify-center items-center'>
        <div className='w-52 h-52 bg-green-500 rounded-lg rotate-45 wc-gem'></div>
      </section>

    </div>
  )
}