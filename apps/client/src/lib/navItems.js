import { BsCollection, BsFillCollectionFill } from "react-icons/bs";
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import { BiSolidHome, BiUser } from "react-icons/bi";
import { PiRocketDuotone, PiRocketFill, PiCoinsDuotone } from "react-icons/pi";
import { RiSparkling2Line, RiSparklingFill } from "react-icons/ri";


export const navItems = [
  { href: "/", icon: BiSolidHome, iconFilled: null, label: "Home" },
  { href: "/collections", icon: BsCollection, iconFilled: BsFillCollectionFill, label: "Collections" },
  { href: "/create", icon: PiRocketDuotone, iconFilled: PiRocketFill, label: "Launchpool" },
  { href: "/profile", icon: BiUser, iconFilled: null, label: "Profile" },
  { href: "/settings", icon: IoSettingsOutline, iconFilled: IoSettingsSharp, label: "Settings" },
  { href: "/genesis", icon: RiSparkling2Line, iconFilled: RiSparklingFill, label: "Genesis", highlight: true },
  { href: "/rewards", icon: PiCoinsDuotone, label: "Point Program" },
];