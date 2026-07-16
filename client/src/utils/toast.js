import toast from 'react-hot-toast';

const showToast = (type, message) => {
  toast.dismiss();
  switch(type) {
    case 'success':
      toast.success(message, { id: message });
      break;
    case 'error':
      toast.error(message, { id: message });
      break;
    case 'warning':
      toast(message, { icon: '⚠️', id: message });
      break;
    default:
      toast(message, { id: message });
  }
};

export default showToast;