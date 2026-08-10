const asArray = (value) => (Array.isArray(value) ? value : []);

export function normalizeProjectIngredientData(data) {
  const source = data && typeof data === "object" ? data : {};
  const store = source.store && typeof source.store === "object" ? source.store : {};
  const seenIngredientIds = new Set();
  const ingredients = asArray(store.ingredients).flatMap((ingredient) => {
    if (!ingredient || typeof ingredient !== "object") return [];
    const id = String(ingredient.id ?? "").trim();
    if (!id || seenIngredientIds.has(id)) return [];
    seenIngredientIds.add(id);
    return [{
      ...ingredient,
      id,
      name: String(ingredient.name ?? "").trim(),
      available: ingredient.available !== false,
      stock: ingredient.stock != null && Number.isInteger(Number(ingredient.stock)) && Number(ingredient.stock) >= 0
        ? Number(ingredient.stock)
        : null,
    }];
  });
  const validIngredientIds = new Set(ingredients.map((ingredient) => ingredient.id));
  const items = asArray(source.items).map((item) => ({
    ...item,
    ingredientIds: [...new Set(
      asArray(item?.ingredientIds)
        .map((id) => String(id).trim())
        .filter((id) => validIngredientIds.has(id)),
    )],
  }));
  return { ...source, store: { ...store, ingredients }, items };
}

export function getMenuAvailability(item, store) {
  const ingredientById = new Map(
    asArray(store?.ingredients).map((ingredient) => [String(ingredient?.id), ingredient]),
  );
  const unavailableIngredients = [...new Set(asArray(item?.ingredientIds).map(String))]
    .map((id) => ingredientById.get(id))
    .filter((ingredient) => ingredient?.available === false);
  const manualSoldOut = item?.soldout === true;
  return {
    soldOut: manualSoldOut || unavailableIngredients.length > 0,
    manualSoldOut,
    unavailableIngredients,
  };
}

export function ingredientAvailabilityStatus(ingredient) {
  return ingredient?.available === false ? "품절" : "재고 정상";
}

export function storeAvailabilityStatus(ingredients) {
  const list = asArray(ingredients);
  const unavailableCount = list.filter((ingredient) => ingredient?.available === false).length;
  if (list.length > 0 && unavailableCount === list.length) return "전체 재료 품절";
  if (unavailableCount > 0) return "일부 재료 품절";
  return "재고 정상";
}

export function soldOutReason(availability) {
  if (availability?.manualSoldOut) return "수동 품절";
  const names = asArray(availability?.unavailableIngredients)
    .map((ingredient) => ingredient?.name)
    .filter(Boolean);
  return names.length ? `재료 소진: ${names.join(", ")}` : "";
}
