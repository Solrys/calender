import React, { useState } from "react";

function AddonsDisplay({ items }) {
  // Filter items with quantity > 0
  const displayedItems = items.filter((item) => item.quantity > 0);
  const maxDisplay = 2;
  const [expanded, setExpanded] = useState(false);

  if (displayedItems.length === 0) return "None";

  const itemsToShow = expanded
    ? displayedItems
    : displayedItems.slice(0, maxDisplay);

  return (
    <div className="flex flex-wrap gap-1">
      {itemsToShow.map((item) => (
        <span
          key={item.id}
          className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
        >
          {item.name} ({item.quantity})
        </span>
      ))}
      {displayedItems.length > maxDisplay && !expanded && (
        <span
          className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          +{displayedItems.length - maxDisplay} more
        </span>
      )}
      {expanded && displayedItems.length > maxDisplay && (
        <span
          className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          View less
        </span>
      )}
    </div>
  );
}

export default AddonsDisplay;
