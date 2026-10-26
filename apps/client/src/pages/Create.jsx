import { useSeo } from "@/hooks/use-seo";
import { pageSeo } from "@/lib/seo";

export default function Create() {
  useSeo(pageSeo("/create"));
  
   
  return (
    <div className="flex justify-center items-center h-[100vh]">
      <h1>Coming Soon...</h1>

    </div>
  );
}
