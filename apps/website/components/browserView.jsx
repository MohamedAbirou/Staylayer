import Image from "next/image";
import React from "react";
import { imageFullWidth } from "./textImageSection";

export default function BrowserView({ imageSrc, alt, url }) {
  return (
    <div className="bg-white rounded-lg shadow-lg mx-auto overflow-hidden border border-gray-200">
      <div className="flex items-center px-6 py-1 bg-gradient-to-b from-gray-50 via-white to-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 bg-gradient-to-br from-red-400 to-red-500 rounded-full hover:from-red-500 hover:to-red-600 cursor-pointer shadow-sm transition-all duration-150 hover:scale-110"></div>
          <div className="w-2.5 h-2.5 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full hover:from-yellow-500 hover:to-yellow-600 cursor-pointer shadow-sm transition-all duration-150 hover:scale-110"></div>
          <div className="w-2.5 h-2.5 bg-gradient-to-br from-green-400 to-green-500 rounded-full hover:from-green-500 hover:to-green-600 cursor-pointer shadow-sm transition-all duration-150 hover:scale-110"></div>
        </div>

        <div className="flex items-center flex-1 ml-8">
          <div className="flex items-center space-x-1 mr-5">
            <button
              className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 transition-all duration-150 disabled:cursor-not-allowed"
              disabled
            >
              <svg
                className="w-3 h-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
            </button>
            <button className="p-1 rounded-full hover:bg-gray-100 transition-all duration-150">
              <svg
                className="w-3 h-3 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </button>
          </div>

          <div className="flex-1 max-w-2xl">
            <div className="relative group">
              <div className="flex items-center opacity-30 bg-gray-50 hover:bg-white rounded-full border border-gray-200 hover:border-gray-300 focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-sm transition-all duration-200 group-hover:shadow-sm">
                <input
                  type="text"
                  value={url}
                  className="flex-1 bg-transparent text-xs p-1 text-center pl-3 text-gray-700 outline-none font-medium placeholder-gray-400"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-8">
          <button
            className="p-2 rounded-full hover:bg-gray-100 transition-all duration-150 group"
            title="More"
          >
            <svg
              className="w-3 h-3 text-gray-600 group-hover:text-gray-800"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="relative">
        <Image
          src={imageSrc}
          alt={alt}
          width={2400}
          height={1800}
          className={`${imageFullWidth} rounded-[0px]`}
          style={{
            borderRadius: "0px",
          }}
        />
      </div>
    </div>
  );
}
