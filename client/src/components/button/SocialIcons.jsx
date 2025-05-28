import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebook, faTwitter, faYoutube } from "@fortawesome/free-brands-svg-icons";

const SocialIcons = () => {
    return (
        <div className="flex gap-3 p-4 rounded-lg items-center">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                className="bg-white w-[50px] h-[50px] rounded-full flex items-center justify-center hover:scale-110 transition">
                <FontAwesomeIcon icon={faFacebook} className="text-[#0DAD4D] text-2xl" />
            </a>

            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
                className="bg-white w-[50px] h-[50px] rounded-full flex items-center justify-center hover:scale-110 transition">
                <FontAwesomeIcon icon={faTwitter} className="text-[#0DAD4D] text-2xl" />
            </a>

            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
                className="bg-white w-[50px] h-[50px] rounded-full flex items-center justify-center hover:scale-110 transition">
                <FontAwesomeIcon icon={faYoutube} className="text-[#0DAD4D] text-2xl" />
            </a>
        </div>
    );
};

export default SocialIcons;
