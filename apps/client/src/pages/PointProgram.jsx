import React from 'react'
import { useSeo } from '@/hooks/use-seo';
import { pageSeo } from '@/lib/seo';

function PointProgram() {
  useSeo(pageSeo('/rewards'));
  return (
   <div className="flex justify-center items-center h-[100vh]">
      <h1>Coming Soon...</h1>

    </div>
  )
}

export default PointProgram
