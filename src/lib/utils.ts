export const formatCurrency = (amount: number): string => {
  if (amount < 1000) return amount.toString();
  
  if (amount < 1000000) {
    const thousands = Math.floor(amount / 1000);
    const remainder = amount % 1000;
    return remainder === 0 ? `${thousands}K` : `${thousands}K${remainder}`;
  }
  
  if (amount < 1000000000) {
    const millions = Math.floor(amount / 1000000);
    const thousands = Math.floor((amount % 1000000) / 1000);
    const remainder = amount % 1000;
    
    let res = `${millions}M`;
    if (thousands > 0) res += `${thousands}K`;
    if (remainder > 0) res += `${remainder}`;
    return res;
  }
  
  return amount.toString();
};
