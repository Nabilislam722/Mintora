import React from 'react';

import "../components/welcome.css";

export default function Welcome() {
  return (
      <div className="hero">
        <h1 className="title">
          Introducing to <div>Mintora</div>
        </h1>
        <div className="light left"></div>
        <div className="light right"></div>
        <button className="btn">
          <a href="/">Launch →</a>
          </button>

      </div>
  )
}